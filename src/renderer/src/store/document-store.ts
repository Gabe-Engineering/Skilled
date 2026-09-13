import { create } from 'zustand'
import type { OpenResult, PickedFile } from '@shared/ipc'
import {
  emptyDocument,
  type Attachment,
  type AttachmentSubdir,
  type SkillDocument,
  type SkillFrontmatter,
  type ValidationIssue
} from '@shared/skill-types'
import { TEMPLATES } from '@shared/templates'
import { validateSkill } from '@shared/validation'
import { deriveDescription, deriveName } from '@renderer/lib/autofill'
import { join } from '@renderer/lib/paths'

export interface Overrides {
  name: boolean
  description: boolean
}

interface DocState {
  doc: SkillDocument
  filePath: string | null
  dirty: boolean
  overrides: Overrides
  issues: ValidationIssue[]
  /**
   * False until the user edits something or opens a real skill. A brand-new blank
   * document is empty on purpose, so greeting it with "Name is required" is noise;
   * `issues` still blocks saving either way.
   */
  touched: boolean
  warnings: string[]
  /** Bumped whenever the editor must reload its content from `doc.bodyMarkdown`. */
  loadToken: number

  newFromTemplate: (id: string) => void
  loadDocument: (result: OpenResult) => void
  setBody: (md: string) => void
  setField: <K extends keyof SkillFrontmatter>(key: K, value: SkillFrontmatter[K]) => void
  resetOverride: (field: keyof Overrides) => void
  setExtraYaml: (yaml: string) => void
  addAttachments: (files: PickedFile[], subdir: AttachmentSubdir) => void
  removeAttachment: (id: string) => void
  setAttachmentSubdir: (id: string, subdir: AttachmentSubdir) => void
  markSaved: (path: string, skillDir: string) => void
  dismissWarnings: () => void
}

let attachmentSeq = 0

/**
 * Re-derive `name`/`description` from the body, but keep the previous
 * `frontmatter` object when nothing actually changed. Typing in the body fires
 * this on every sync tick; a fresh object each time re-rendered the whole
 * properties panel for no reason.
 */
function withAutofill(doc: SkillDocument, overrides: Overrides): SkillDocument {
  const fm = doc.frontmatter
  const name = overrides.name ? fm.name : deriveName(doc.bodyMarkdown)
  const description = overrides.description ? fm.description : deriveDescription(doc.bodyMarkdown)
  if (name === fm.name && description === fm.description) return doc
  return { ...doc, frontmatter: { ...fm, name, description } }
}

/**
 * `validateSkill` allocates a new array every call, which invalidates every
 * subscriber. Hand back the previous array when the issues are identical.
 */
function stableIssues(previous: ValidationIssue[], next: ValidationIssue[]): ValidationIssue[] {
  if (previous.length !== next.length) return next
  for (let i = 0; i < next.length; i++) {
    const a = previous[i]
    const b = next[i]
    if (a.id !== b.id || a.level !== b.level || a.message !== b.message || a.fix !== b.fix)
      return next
  }
  return previous
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: emptyDocument(),
  filePath: null,
  dirty: false,
  overrides: { name: false, description: false },
  issues: validateSkill(emptyDocument()),
  touched: false,
  warnings: [],
  loadToken: 0,

  newFromTemplate: (id) => {
    const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0]
    const overrides = { name: false, description: false }
    const doc = withAutofill(t.make(), overrides)
    set({
      doc,
      filePath: null,
      dirty: false,
      overrides,
      issues: validateSkill(doc),
      touched: !!doc.bodyMarkdown.trim(),
      warnings: [],
      loadToken: get().loadToken + 1
    })
  },

  loadDocument: (result) => {
    const overrides = {
      name: !!result.doc.frontmatter.name,
      description: !!result.doc.frontmatter.description
    }
    const doc = withAutofill(result.doc, overrides)
    set({
      doc,
      filePath: result.path,
      dirty: false,
      overrides,
      issues: validateSkill(doc),
      touched: true,
      warnings: result.warnings,
      loadToken: get().loadToken + 1
    })
  },

  setBody: (md) => {
    const { doc, overrides } = get()
    if (md === doc.bodyMarkdown) return
    const next = withAutofill({ ...doc, bodyMarkdown: md }, overrides)
    set({
      doc: next,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  setField: (key, value) => {
    const { doc, overrides } = get()
    const fm: SkillFrontmatter = { ...doc.frontmatter }
    const bag = fm as unknown as Record<string, unknown>
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      if (key === 'name' || key === 'description') bag[key] = ''
      else delete bag[key]
    } else {
      bag[key] = value
    }
    const nextOverrides =
      key === 'name'
        ? { ...overrides, name: true }
        : key === 'description'
          ? { ...overrides, description: true }
          : overrides
    const next = { ...doc, frontmatter: fm }
    set({
      doc: next,
      overrides: nextOverrides,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  resetOverride: (field) => {
    const { doc, overrides } = get()
    const nextOverrides = { ...overrides, [field]: false }
    const next = withAutofill(doc, nextOverrides)
    set({
      doc: next,
      overrides: nextOverrides,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  setExtraYaml: (yaml) => {
    const { doc } = get()
    const next = { ...doc, extraYaml: yaml }
    set({
      doc: next,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  addAttachments: (files, subdir) => {
    const { doc } = get()
    const added: Attachment[] = files.map((f) => ({
      id: `new:${++attachmentSeq}:${f.fileName}`,
      sourcePath: f.sourcePath,
      fileName: f.fileName,
      subdir,
      size: f.size,
      origin: 'new'
    }))
    const next = { ...doc, attachments: [...doc.attachments, ...added] }
    set({
      doc: next,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  removeAttachment: (id) => {
    const { doc } = get()
    const next = { ...doc, attachments: doc.attachments.filter((a) => a.id !== id) }
    set({
      doc: next,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  setAttachmentSubdir: (id, subdir) => {
    const { doc } = get()
    const next = {
      ...doc,
      attachments: doc.attachments.map((a) => (a.id === id ? { ...a, subdir } : a))
    }
    set({
      doc: next,
      dirty: true,
      touched: true,
      issues: stableIssues(get().issues, validateSkill(next))
    })
  },

  markSaved: (path, skillDir) => {
    const { doc } = get()
    // After export, every attachment lives inside the skill folder; point at those copies
    // so later saves no longer depend on the original files.
    const attachments: Attachment[] = doc.attachments.map((a) => ({
      ...a,
      origin: 'existing',
      sourcePath: join(a.subdir ? join(skillDir, a.subdir) : skillDir, a.fileName)
    }))
    set({ filePath: path, dirty: false, doc: { ...doc, attachments } })
  },

  dismissWarnings: () => set({ warnings: [] })
}))
