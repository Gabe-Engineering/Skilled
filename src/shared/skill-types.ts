/** Frontmatter keys Skilled understands natively. Anything else round-trips via `extraYaml`. */
export interface SkillFrontmatter {
  name: string
  description: string
  'argument-hint'?: string
  'user-invocable'?: boolean
  'disable-model-invocation'?: boolean
  model?: string
  'allowed-tools'?: string[]
}

/** Emission order for known keys. Matches the order seen in real skills. */
export const KNOWN_KEYS = [
  'name',
  'description',
  'argument-hint',
  'user-invocable',
  'disable-model-invocation',
  'model',
  'allowed-tools'
] as const

export type KnownKey = (typeof KNOWN_KEYS)[number]

export type AttachmentSubdir = 'references' | 'scripts' | 'assets' | ''

export interface Attachment {
  id: string
  /** Absolute path of the file on disk right now. */
  sourcePath: string
  fileName: string
  subdir: AttachmentSubdir
  size?: number
  /** `existing` = already inside the opened skill folder; never removed on export. */
  origin: 'new' | 'existing'
}

export interface SkillDocument {
  frontmatter: SkillFrontmatter
  /** Free-form YAML for keys Skilled does not model. Kept verbatim. */
  extraYaml: string
  bodyMarkdown: string
  attachments: Attachment[]
}

export type IssueField =
  | 'name'
  | 'description'
  | 'argument-hint'
  | 'model'
  | 'allowed-tools'
  | 'extraYaml'
  | 'body'
  | 'attachments'

export interface ValidationIssue {
  id: string
  level: 'error' | 'warning'
  field?: IssueField
  message: string
  /** A suggested replacement value, when one exists (e.g. kebab-cased name). */
  fix?: string
}

export function emptyDocument(): SkillDocument {
  return {
    frontmatter: { name: '', description: '' },
    extraYaml: '',
    bodyMarkdown: '',
    attachments: []
  }
}
