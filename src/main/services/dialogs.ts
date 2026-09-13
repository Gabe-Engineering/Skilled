import { BrowserWindow, dialog } from 'electron'
import { basename, dirname } from 'path'
import type { PickedFile, UnsavedChoice } from '@shared/ipc'
import { promises as fs } from 'fs'
import { store } from '../store'

export async function pickSkillFile(win: BrowserWindow): Promise<string | null> {
  const r = await dialog.showOpenDialog(win, {
    title: 'Open skill',
    defaultPath: store.get().lastOpenDir,
    filters: [
      { name: 'Skill', extensions: ['md'] },
      { name: 'All files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (r.canceled || !r.filePaths[0]) return null
  const p = r.filePaths[0]
  store.set({ lastOpenDir: dirname(p) })
  return p
}

export async function pickExportDir(win: BrowserWindow): Promise<string | null> {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose where to create the skill folder',
    buttonLabel: 'Export here',
    defaultPath: store.get().lastExportDir,
    properties: ['openDirectory', 'createDirectory']
  })
  if (r.canceled || !r.filePaths[0]) return null
  store.set({ lastExportDir: r.filePaths[0] })
  return r.filePaths[0]
}

export async function pickAttachments(
  win: BrowserWindow,
  kind: 'references' | 'scripts' | 'other'
): Promise<PickedFile[]> {
  const titles = {
    references: 'Add reference files',
    scripts: 'Add script files',
    other: 'Add files'
  }
  const filters =
    kind === 'references'
      ? [
          { name: 'Documents', extensions: ['md', 'txt', 'json', 'yaml', 'yml', 'csv', 'html'] },
          { name: 'All files', extensions: ['*'] }
        ]
      : kind === 'scripts'
        ? [
            {
              name: 'Scripts',
              extensions: ['py', 'sh', 'ps1', 'js', 'mjs', 'ts', 'rb', 'bat', 'cmd']
            },
            { name: 'All files', extensions: ['*'] }
          ]
        : [{ name: 'All files', extensions: ['*'] }]
  const r = await dialog.showOpenDialog(win, {
    title: titles[kind],
    filters,
    properties: ['openFile', 'multiSelections']
  })
  if (r.canceled) return []
  const out: PickedFile[] = []
  for (const p of r.filePaths) {
    let size = 0
    try {
      size = (await fs.stat(p)).size
    } catch {
      size = 0
    }
    out.push({ sourcePath: p, fileName: basename(p), size })
  }
  return out
}

export async function confirmUnsaved(win: BrowserWindow, docName: string): Promise<UnsavedChoice> {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Skilled',
    message: `Do you want to save changes to ${docName || 'this skill'}?`,
    detail: 'Your changes will be lost if you don’t save them.',
    buttons: ['Save', 'Don’t Save', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })
  return r.response === 0 ? 'save' : r.response === 1 ? 'discard' : 'cancel'
}

export async function confirmOverwrite(win: BrowserWindow, skillDir: string): Promise<boolean> {
  const r = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Skilled',
    message: 'A skill already exists here. Replace its SKILL.md?',
    detail: `${skillDir}\n\nOther files in that folder are kept.`,
    buttons: ['Replace', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })
  return r.response === 0
}

export function showError(win: BrowserWindow | null, message: string, detail?: string): void {
  if (win && !win.isDestroyed()) {
    dialog.showMessageBox(win, { type: 'error', title: 'Skilled', message, detail, noLink: true })
  } else {
    dialog.showErrorBox(message, detail || '')
  }
}
