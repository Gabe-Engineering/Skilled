import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'
import { basename, dirname, join } from './paths'

const api = (): Window['skilled'] => window.skilled

function toast(kind: 'info' | 'success' | 'error', message: string, detail?: string): void {
  useUiStore.getState().toast(kind, message, detail)
}

/** Blocks export on errors; warnings are allowed through. */
function blockingErrors(): string | null {
  const { issues } = useDocStore.getState()
  const errors = issues.filter((i) => i.level === 'error')
  if (!errors.length) return null
  return errors.map((e) => e.message).join('\n')
}

async function doExport(destRoot: string): Promise<boolean> {
  const { doc, markSaved } = useDocStore.getState()
  const r = await api().exportSkill(doc, destRoot)
  if (!r) return false
  if ('error' in r) {
    toast('error', 'Export failed', r.error)
    return false
  }
  markSaved(r.skillMdPath, r.skillDir)
  const extra = r.copied.length
    ? ` + ${r.copied.length} file${r.copied.length === 1 ? '' : 's'}`
    : ''
  toast('success', `Saved to ${r.skillDir}`, `SKILL.md${extra}`)
  for (const w of r.warnings) toast('error', w)
  await refreshRecents()
  return true
}

async function ensureNoCollision(
  destRoot: string,
  name: string,
  allowSameDir?: string
): Promise<boolean> {
  const target = join(destRoot, name)
  if (allowSameDir && target.toLowerCase() === allowSameDir.toLowerCase()) return true
  const c = await api().checkCollision(destRoot, name)
  if (!c.hasSkillMd) return true
  return api().confirmOverwrite(target)
}

export async function save(): Promise<boolean> {
  const errors = blockingErrors()
  if (errors) {
    useUiStore.getState().setPanelOpen(true)
    toast('error', 'Fix these before saving', errors)
    return false
  }
  const { doc, filePath } = useDocStore.getState()
  if (!filePath) return exportAs()
  const currentDir = dirname(filePath)
  const destRoot = dirname(currentDir)
  const name = doc.frontmatter.name.trim()
  if (name !== basename(currentDir)) {
    const ok = await ensureNoCollision(destRoot, name)
    if (!ok) return false
  }
  return doExport(destRoot)
}

export async function exportAs(): Promise<boolean> {
  const errors = blockingErrors()
  if (errors) {
    useUiStore.getState().setPanelOpen(true)
    toast('error', 'Fix these before exporting', errors)
    return false
  }
  const root = await api().pickExportDir()
  if (!root) return false
  const { doc, filePath } = useDocStore.getState()
  const ok = await ensureNoCollision(
    root,
    doc.frontmatter.name.trim(),
    filePath ? dirname(filePath) : undefined
  )
  if (!ok) return false
  return doExport(root)
}

/** Returns true when it is safe to discard the current document. */
export async function confirmDiscardIfDirty(): Promise<boolean> {
  const { dirty, doc } = useDocStore.getState()
  if (!dirty) return true
  const choice = await api().confirmUnsaved(doc.frontmatter.name || 'Untitled')
  if (choice === 'cancel') return false
  if (choice === 'discard') return true
  return save()
}

export async function openSkill(path?: string): Promise<void> {
  if (!(await confirmDiscardIfDirty())) return
  const r = path ? await api().openSkill(path) : await api().openSkill()
  if (!r) return
  if ('error' in r) {
    toast('error', 'Could not open skill', r.error)
    await refreshRecents()
    return
  }
  useDocStore.getState().loadDocument(r)
  if (r.warnings.length) toast('info', 'Opened with notes', r.warnings.join('\n'))
  await refreshRecents()
}

export async function startNew(): Promise<void> {
  if (!(await confirmDiscardIfDirty())) return
  useUiStore.getState().setNewDialogOpen(true)
}

export function showInFolder(): void {
  const { filePath } = useDocStore.getState()
  if (!filePath) {
    toast('info', 'This skill has not been exported yet.')
    return
  }
  void api().showInFolder(filePath)
}

export async function refreshRecents(): Promise<void> {
  const s = await api().getState()
  useUiStore.getState().setRecentFiles(s.recentFiles)
}

export async function toggleSpell(): Promise<void> {
  const ui = useUiStore.getState()
  const next = !ui.spellOn
  ui.setSpell(next)
  await api().setSpellEnabled(next)
}

export async function handleCloseRequest(): Promise<void> {
  const ok = await confirmDiscardIfDirty()
  await api().replyClose(ok)
}
