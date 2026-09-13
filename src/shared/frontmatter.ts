import { dump, load } from 'js-yaml'
import { normalizeMarkdown } from './markdown-text'
import { KNOWN_KEYS, type SkillDocument, type SkillFrontmatter } from './skill-types'

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/

export interface SplitResult {
  yaml: string | null
  body: string
}

/** Split a SKILL.md into its YAML block (without fences) and Markdown body. */
export function splitFrontmatter(text: string): SplitResult {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const m = clean.match(FM_RE)
  if (!m) return { yaml: null, body: clean }
  return { yaml: m[1], body: m[2] }
}

export interface ParsedFrontmatter {
  frontmatter: SkillFrontmatter
  extraYaml: string
  warnings: string[]
}

/** Very forgiving line parser used when strict YAML fails (e.g. `argument-hint: [a] [b]`). */
function lenientParse(yaml: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let lastKey: string | null = null
  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = line.match(/^\s+-\s+(.*)$/)
    if (item && lastKey) {
      const cur = out[lastKey]
      const arr = Array.isArray(cur) ? cur : cur === '' || cur == null ? [] : [String(cur)]
      arr.push(stripQuotes(item[1]))
      out[lastKey] = arr
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (kv) {
      lastKey = kv[1]
      out[lastKey] = stripQuotes(kv[2])
    }
  }
  return out
}

function stripQuotes(s: string): string {
  const t = s.trim()
  if (
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
  ) {
    return t.slice(1, -1)
  }
  return t
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (t === 'true' || t === 'yes') return true
    if (t === 'false' || t === 'no') return false
  }
  return undefined
}

function toStringList(v: unknown): string[] | undefined {
  if (v == null || v === '') return undefined
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return [String(v)]
}

function toStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function parseFrontmatter(yaml: string | null): ParsedFrontmatter {
  const warnings: string[] = []
  if (yaml == null) {
    warnings.push('No frontmatter found. Name and description are empty.')
    return { frontmatter: { name: '', description: '' }, extraYaml: '', warnings }
  }
  let obj: Record<string, unknown> = {}
  try {
    const loaded = load(yaml)
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      obj = loaded as Record<string, unknown>
    } else if (loaded != null) {
      warnings.push('Frontmatter is not a YAML mapping. Loaded loosely.')
      obj = lenientParse(yaml)
    }
  } catch {
    warnings.push('Frontmatter is not valid YAML. Loaded loosely; check the fields.')
    obj = lenientParse(yaml)
  }

  const fm: SkillFrontmatter = {
    name: toStr(obj.name).trim(),
    description: toStr(obj.description).trim()
  }
  const hint = toStr(obj['argument-hint']).trim()
  if (hint) fm['argument-hint'] = hint
  const ui = toBool(obj['user-invocable'])
  if (ui !== undefined) fm['user-invocable'] = ui
  const dmi = toBool(obj['disable-model-invocation'])
  if (dmi !== undefined) fm['disable-model-invocation'] = dmi
  const model = toStr(obj.model).trim()
  if (model) fm.model = model
  const tools = toStringList(obj['allowed-tools'])
  if (tools && tools.length) fm['allowed-tools'] = tools

  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(k)) extra[k] = v
  }
  const extraYaml = Object.keys(extra).length
    ? dump(extra, { lineWidth: -1, noRefs: true }).trimEnd()
    : ''
  return { frontmatter: fm, extraYaml, warnings }
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter
  extraYaml: string
  bodyMarkdown: string
  warnings: string[]
}

export function parseSkillMd(text: string): ParsedSkill {
  const { yaml, body } = splitFrontmatter(text)
  const { frontmatter, extraYaml, warnings } = parseFrontmatter(yaml)
  return { frontmatter, extraYaml, bodyMarkdown: normalizeBody(body), warnings }
}

/** Parse the "Additional YAML" block. Throws on invalid YAML or non-mapping. */
export function parseExtraYaml(extraYaml: string): Record<string, unknown> {
  if (!extraYaml.trim()) return {}
  const loaded = load(extraYaml)
  if (loaded == null) return {}
  if (typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error('Additional YAML must be a mapping of key: value pairs.')
  }
  return loaded as Record<string, unknown>
}

export function normalizeBody(md: string): string {
  return normalizeMarkdown(md)
}

/** Build the frontmatter object in canonical key order. */
export function buildFrontmatterObject(doc: SkillDocument): Record<string, unknown> {
  const f = doc.frontmatter
  const fm: Record<string, unknown> = {}
  fm.name = f.name.trim()
  fm.description = f.description.trim()
  if (f['argument-hint']?.trim()) fm['argument-hint'] = f['argument-hint'].trim()
  if (f['user-invocable'] !== undefined) fm['user-invocable'] = f['user-invocable']
  if (f['disable-model-invocation'] !== undefined) {
    fm['disable-model-invocation'] = f['disable-model-invocation']
  }
  if (f.model?.trim()) fm.model = f.model.trim()
  if (f['allowed-tools']?.length) {
    fm['allowed-tools'] = f['allowed-tools'].map((t) => t.trim()).filter(Boolean)
  }
  let extra: Record<string, unknown> = {}
  try {
    extra = parseExtraYaml(doc.extraYaml)
  } catch {
    // validation reports this; serialize without the broken block
  }
  for (const [k, v] of Object.entries(extra)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(k)) fm[k] = v
  }
  return fm
}

export function serializeFrontmatter(doc: SkillDocument): string {
  return dump(buildFrontmatterObject(doc), { lineWidth: -1, noRefs: true })
}

export function serializeSkillMd(doc: SkillDocument): string {
  const yaml = serializeFrontmatter(doc)
  return `---\n${yaml}---\n\n${normalizeBody(doc.bodyMarkdown)}`
}
