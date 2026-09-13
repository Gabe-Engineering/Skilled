import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type MenuActionPayload, type PersistedState, type SkilledApi } from '@shared/ipc'
import type { SkillDocument } from '@shared/skill-types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}

const api: SkilledApi = {
  openSkill: (path?: string) => ipcRenderer.invoke(IPC.skillOpen, { path }),
  exportSkill: (doc: SkillDocument, destRoot: string | null) =>
    ipcRenderer.invoke(IPC.skillExport, { doc, destRoot }),
  pickExportDir: () => ipcRenderer.invoke(IPC.dialogPickExportDir),
  checkCollision: (destRoot: string, name: string) =>
    ipcRenderer.invoke(IPC.skillCollisionCheck, { destRoot, name }),
  confirmOverwrite: (skillDir: string) => ipcRenderer.invoke(IPC.dialogConfirmOverwrite, { skillDir }),
  pickAttachments: (kind) => ipcRenderer.invoke(IPC.dialogPickAttachments, { kind }),
  confirmUnsaved: (docName: string) => ipcRenderer.invoke(IPC.dialogConfirmUnsaved, { docName }),
  getState: () => ipcRenderer.invoke(IPC.stateGet),
  setState: (patch: Partial<PersistedState>) => ipcRenderer.invoke(IPC.stateSet, patch),
  clearRecents: () => ipcRenderer.invoke(IPC.stateClearRecents),
  setSpellEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC.spellSetEnabled, { enabled }),
  setSpellLanguage: (lang: string) => ipcRenderer.invoke(IPC.spellSetLanguage, { lang }),
  setDirty: (dirty: boolean, title: string) => ipcRenderer.invoke(IPC.appSetDirty, { dirty, title }),
  replyClose: (proceed: boolean) => ipcRenderer.invoke(IPC.appCloseReply, { proceed }),
  showInFolder: (path: string) => ipcRenderer.invoke(IPC.shellShowInFolder, { path }),
  getAppInfo: () => ipcRenderer.invoke(IPC.appGetInfo),
  onMenu: (cb: (payload: MenuActionPayload) => void) => subscribe(IPC.menuAction, cb),
  onRequestClose: (cb: () => void) => subscribe(IPC.appRequestClose, cb),
  onSpellChanged: (cb) => subscribe(IPC.spellChanged, cb)
}

contextBridge.exposeInMainWorld('skilled', api)
