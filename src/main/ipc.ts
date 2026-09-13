import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { basename, dirname } from 'path'
import { IPC, type PersistedState } from '@shared/ipc'
import type { SkillDocument } from '@shared/skill-types'
import { store } from './store'
import { allowClose } from './window'
import { setSpellEnabled, setSpellLanguage } from './context-menu'
import { collisionCheck, exportSkill, readSkill } from './services/skill-io'
import {
  confirmOverwrite,
  confirmUnsaved,
  pickAttachments,
  pickExportDir,
  pickSkillFile
} from './services/dialogs'

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

function winOf(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (!w) throw new Error('No window for IPC event')
  return w
}

async function openPath(path: string): Promise<ReturnType<typeof readSkill> extends Promise<infer T> ? T : never> {
  const result = await readSkill(path)
  store.addRecent({
    path,
    name: result.doc.frontmatter.name || basename(dirname(path)),
    lastOpened: Date.now()
  })
  return result
}

export function registerIpc(): void {
  ipcMain.handle(IPC.skillOpen, async (event, { path }: { path?: string }) => {
    const win = winOf(event)
    const p = path ?? (await pickSkillFile(win))
    if (!p) return null
    try {
      return await openPath(p)
    } catch (e) {
      return { error: errorMessage(e) }
    }
  })

  ipcMain.handle(IPC.skillReadPath, async (_event, { path }: { path: string }) => {
    try {
      return await openPath(path)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOENT') store.removeRecent(path)
      return { error: code === 'ENOENT' ? 'That file no longer exists.' : errorMessage(e) }
    }
  })

  ipcMain.handle(IPC.dialogPickExportDir, async (event) => pickExportDir(winOf(event)))

  ipcMain.handle(
    IPC.skillCollisionCheck,
    async (_event, { destRoot, name }: { destRoot: string; name: string }) =>
      collisionCheck(destRoot, name)
  )

  ipcMain.handle(IPC.dialogConfirmOverwrite, async (event, { skillDir }: { skillDir: string }) =>
    confirmOverwrite(winOf(event), skillDir)
  )

  ipcMain.handle(
    IPC.skillExport,
    async (event, { doc, destRoot }: { doc: SkillDocument; destRoot: string | null }) => {
      const win = winOf(event)
      const root = destRoot ?? (await pickExportDir(win))
      if (!root) return null
      try {
        const result = await exportSkill(root, doc)
        store.addRecent({
          path: result.skillMdPath,
          name: doc.frontmatter.name,
          lastOpened: Date.now()
        })
        return result
      } catch (e) {
        return { error: errorMessage(e) }
      }
    }
  )

  ipcMain.handle(
    IPC.dialogPickAttachments,
    async (event, { kind }: { kind: 'references' | 'scripts' | 'other' }) =>
      pickAttachments(winOf(event), kind)
  )

  ipcMain.handle(IPC.dialogConfirmUnsaved, async (event, { docName }: { docName: string }) =>
    confirmUnsaved(winOf(event), docName)
  )

  ipcMain.handle(IPC.stateGet, async () => store.get())
  ipcMain.handle(IPC.stateSet, async (_event, patch: Partial<PersistedState>) => {
    store.set(patch)
  })
  ipcMain.handle(IPC.stateClearRecents, async () => store.clearRecents())

  ipcMain.handle(IPC.spellSetEnabled, async (event, { enabled }: { enabled: boolean }) => {
    setSpellEnabled(winOf(event), enabled)
  })
  ipcMain.handle(IPC.spellSetLanguage, async (event, { lang }: { lang: string }) => ({
    available: setSpellLanguage(winOf(event), lang)
  }))

  ipcMain.handle(
    IPC.appSetDirty,
    async (event, { dirty, title }: { dirty: boolean; title: string }) => {
      const win = winOf(event)
      win.setTitle(`${dirty ? '*' : ''}${title || 'Untitled'} - Skilled`)
      win.setDocumentEdited(dirty)
    }
  )

  ipcMain.handle(IPC.appCloseReply, async (event, { proceed }: { proceed: boolean }) => {
    if (!proceed) return
    allowClose()
    winOf(event).close()
  })

  ipcMain.handle(IPC.shellShowInFolder, async (_event, { path }: { path: string }) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle(IPC.appGetInfo, async () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))
}
