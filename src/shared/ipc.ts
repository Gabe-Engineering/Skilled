import type { SkillDocument } from './skill-types'

export const IPC = {
  skillOpen: 'skill:open',
  skillReadPath: 'skill:read-path',
  skillExport: 'skill:export',
  skillCollisionCheck: 'skill:collision-check',
  dialogPickAttachments: 'dialog:pick-attachments',
  dialogConfirmUnsaved: 'dialog:confirm-unsaved',
  dialogConfirmOverwrite: 'dialog:confirm-overwrite',
  dialogPickExportDir: 'dialog:pick-export-dir',
  stateGet: 'state:get',
  stateSet: 'state:set',
  stateClearRecents: 'state:clear-recents',
  spellSetEnabled: 'spell:set-enabled',
  spellSetLanguage: 'spell:set-language',
  appSetDirty: 'app:set-dirty',
  appCloseReply: 'app:close-reply',
  shellShowInFolder: 'shell:show-in-folder',
  appGetInfo: 'app:get-info',
  // main -> renderer
  menuAction: 'menu:action',
  appRequestClose: 'app:request-close',
  spellChanged: 'spell:changed'
} as const

export interface RecentEntry {
  /** Absolute path of the SKILL.md file. */
  path: string
  name: string
  lastOpened: number
}

export interface PersistedState {
  windowBounds?: { x: number; y: number; width: number; height: number }
  isMaximized?: boolean
  recentFiles: RecentEntry[]
  spellLang: string
  spellcheckOn: boolean
  panelOpen: boolean
  previewOpen: boolean
  lastOpenDir?: string
  lastExportDir?: string
}

export interface OpenResult {
  path: string
  raw: string
  doc: SkillDocument
  warnings: string[]
}

export interface ExportResult {
  skillDir: string
  skillMdPath: string
  copied: string[]
  warnings: string[]
}

export interface PickedFile {
  sourcePath: string
  fileName: string
  size: number
}

export type MenuAction =
  | 'new'
  | 'open'
  | 'save'
  | 'export-as'
  | 'toggle-preview'
  | 'toggle-panel'
  | 'toggle-spell'
  | 'open-recent'
  | 'show-in-folder'
  | 'about'

export interface MenuActionPayload {
  action: MenuAction
  arg?: string
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export interface AppInfo {
  version: string
  electron: string
  userDataPath: string
}

/** The API exposed on `window.skilled` by the preload script. */
export interface SkilledApi {
  openSkill: (path?: string) => Promise<OpenResult | { error: string } | null>
  exportSkill: (
    doc: SkillDocument,
    destRoot: string | null
  ) => Promise<ExportResult | { error: string } | null>
  pickExportDir: () => Promise<string | null>
  checkCollision: (
    destRoot: string,
    name: string
  ) => Promise<{ exists: boolean; hasSkillMd: boolean }>
  confirmOverwrite: (skillDir: string) => Promise<boolean>
  pickAttachments: (kind: 'references' | 'scripts' | 'other') => Promise<PickedFile[]>
  confirmUnsaved: (docName: string) => Promise<UnsavedChoice>
  getState: () => Promise<PersistedState>
  setState: (patch: Partial<PersistedState>) => Promise<void>
  clearRecents: () => Promise<void>
  setSpellEnabled: (enabled: boolean) => Promise<void>
  setSpellLanguage: (lang: string) => Promise<{ available: string[] }>
  setDirty: (dirty: boolean, title: string) => Promise<void>
  replyClose: (proceed: boolean) => Promise<void>
  showInFolder: (path: string) => Promise<void>
  getAppInfo: () => Promise<AppInfo>
  onMenu: (cb: (payload: MenuActionPayload) => void) => () => void
  onRequestClose: (cb: () => void) => () => void
  onSpellChanged: (cb: (p: { lang: string; enabled: boolean }) => void) => () => void
}
