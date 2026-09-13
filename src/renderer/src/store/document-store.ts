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
  markSaved: (path: string) => void
  dismissWarnings: () => void
}

let attachmentSeq = 0

function withAutofill(doc: SkillDocument, overrides: Overrides): SkillDocument {
  const fm = { ...doc.frontmatter }
  if (!overrides.name) fm.name = deriveName(doc.bodyMarkdown)
  if (!overrides.description) fm.description = deriveDescription(doc.bodyMarkdown)
  return { ...doc, frontmatter: fm }
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: emptyDocument(),
  filePath: null,
  dirty: false,
  overrides: { name: false, description: false },
  issues: validateSkill(emptyDocument()),
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
      warnings: [],
      loadToken: get().loadToken + 1
    })
  },

  loadDocument: (result) => {
    const overrides = { name: !!result.doc.frontmatter.name, description: !!result.doc.frontmatter.description }
    const doc = withAutofill(result.doc, overrides)
    set({
      doc,
      filePath: result.path,
      dirty: false,
      overrides,
      issues: validateSkill(doc),
      warnings: result.warnings,
      loadToken: get().loadToken + 1
    })
  },

  setBody: (md) => {
    const { doc, overrides, dirty } = get()
    if (md === doc.bodyMarkdown) return
    const next = withAutofill({ ...doc, bodyMarkdown: md }, overrides)
    set({ doc: next, dirty: dirty || true, issues: validateSkill(next) })
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
      key === 'name' ? { ...overrides, name: true } : key === 'description' ? { ...overrides, description: true } : overrides
    const next = { ...doc, frontmatter: fm }
    set({ doc: next, overrides: nextOverrides, dirty: true, issues: validateSkill(next) })
  },

  resetOverride: (field) => {
    const { doc, overrides } = get()
    const nextOverrides = { ...overrides, [field]: false }
    const next = withAutofill(doc, nextOverrides)
    set({ doc: next, overrides: nextOverrides, dirty: true, issues: validateSkill(next) })
  },

  setExtraYaml: (yaml) => {
    const { doc } = get()
    const next = { ...doc, extraYaml: yaml }
    set({ doc: next, dirty: true, issues: validateSkill(next) })
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
    set({ doc: next, dirty: true, issues: validateSkill(next) })
  },

  removeAttachment: (id) => {
    const { doc } = get()
    const next = { ...doc, attachments: doc.attachments.filter((a) => a.id !== id) }
    set({ doc: next, dirty: true, issues: validateSkill(next) })
  },

  setAttachmentSubdir: (id, subdir) => {
    const { doc } = get()
    const next = {
      ...doc,
      attachments: doc.attachments.map((a) => (a.id === id ? { ...a, subdir } : a))
    }
    set({ doc: next, dirty: true, issues: validateSkill(next) })
  },

  markSaved: (path) => {
    const { doc } = get()
    // After export, previously "new" attachments now live inside the skill folder.
    set({ filePath: path, dirty: false, doc: { ...doc, attachments: doc.attachments.map((a) => ({ ...a })) } })
  },

  dismissWarnings: () => set({ warnings: [] })
}))
