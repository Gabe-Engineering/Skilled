import { promises as fs } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import { parseSkillMd, serializeSkillMd } from '@shared/frontmatter'
import { isKebabCase } from '@shared/kebab'
import type { ExportResult, OpenResult } from '@shared/ipc'
import type { Attachment, AttachmentSubdir, SkillDocument } from '@shared/skill-types'

const ATTACHMENT_DIRS: AttachmentSubdir[] = ['references', 'scripts', 'assets']

function safeFileName(name: string): boolean {
  return !!name && !/[\\/]/.test(name) && name !== '.' && name !== '..' && !name.includes('\0')
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function listExistingAttachments(skillDir: string): Promise<Attachment[]> {
  const out: Attachment[] = []
  for (const sub of ATTACHMENT_DIRS) {
    const dir = join(skillDir, sub)
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (!e.isFile()) continue
      const p = join(dir, e.name)
      let size: number | undefined
      try {
        size = (await fs.stat(p)).size
      } catch {
        size = undefined
      }
      out.push({
        id: `existing:${sub}/${e.name}`,
        sourcePath: p,
        fileName: e.name,
        subdir: sub,
        size,
        origin: 'existing'
      })
    }
  }
  return out
}

export async function readSkill(path: string): Promise<OpenResult> {
  const raw = await fs.readFile(path, 'utf8')
  const parsed = parseSkillMd(raw)
  const skillDir = dirname(path)
  const attachments = await listExistingAttachments(skillDir)
  const doc: SkillDocument = {
    frontmatter: parsed.frontmatter,
    extraYaml: parsed.extraYaml,
    bodyMarkdown: parsed.bodyMarkdown,
    attachments
  }
  if (!doc.frontmatter.name) {
    const folder = basename(skillDir)
    if (isKebabCase(folder)) doc.frontmatter.name = folder
  }
  return { path, raw, doc, warnings: parsed.warnings }
}

export async function collisionCheck(
  destRoot: string,
  name: string
): Promise<{ exists: boolean; hasSkillMd: boolean }> {
  const dir = join(destRoot, name)
  const dirExists = await exists(dir)
  const hasSkillMd = dirExists && (await exists(join(dir, 'SKILL.md')))
  return { exists: dirExists, hasSkillMd }
}

async function writeAtomic(target: string, content: string): Promise<void> {
  const tmp = target + '.tmp'
  await fs.writeFile(tmp, content, 'utf8')
  try {
    await fs.rename(tmp, target)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
      await fs.rm(tmp, { force: true })
      throw new Error('SKILL.md is open in another program. Close it and try again.')
    }
    throw e
  }
}

export async function exportSkill(destRoot: string, doc: SkillDocument): Promise<ExportResult> {
  const name = doc.frontmatter.name.trim()
  if (!isKebabCase(name)) throw new Error(`"${name}" is not a valid skill name (use kebab-case).`)
  const skillDir = resolve(destRoot, name)
  await fs.mkdir(skillDir, { recursive: true })

  const skillMdPath = join(skillDir, 'SKILL.md')
  await writeAtomic(skillMdPath, serializeSkillMd(doc))

  const copied: string[] = []
  const warnings: string[] = []
  for (const a of doc.attachments) {
    if (!safeFileName(a.fileName)) {
      warnings.push(`Skipped attachment with unsafe name: ${a.fileName}`)
      continue
    }
    const targetDir = a.subdir ? join(skillDir, a.subdir) : skillDir
    const target = join(targetDir, a.fileName)
    if (resolve(a.sourcePath) === resolve(target)) continue
    if (!(await exists(a.sourcePath))) {
      warnings.push(`Attachment no longer exists: ${a.sourcePath}`)
      continue
    }
    await fs.mkdir(targetDir, { recursive: true })
    await fs.copyFile(a.sourcePath, target)
    copied.push(target)
  }

  return { skillDir, skillMdPath, copied, warnings }
}
