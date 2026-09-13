import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IPC, type MenuAction } from '@shared/ipc'
import { store } from './store'

function send(win: BrowserWindow | null, action: MenuAction, arg?: string): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC.menuAction, { action, arg })
}

export function buildMenu(getWin: () => BrowserWindow | null): void {
  const state = store.get()
  const recents: MenuItemConstructorOptions[] = state.recentFiles.length
    ? [
        ...state.recentFiles.map((r) => ({
          label: `${r.name}  —  ${r.path}`,
          click: () => send(getWin(), 'open-recent', r.path)
        })),
        { type: 'separator' as const },
        { label: 'Clear Recent', click: () => store.clearRecents() }
      ]
    : [{ label: 'No recent skills', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        { label: 'New…', accelerator: 'CmdOrCtrl+N', click: () => send(getWin(), 'new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send(getWin(), 'open') },
        { label: 'Open Recent', submenu: recents },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send(getWin(), 'save') },
        {
          label: 'Export As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send(getWin(), 'export-as')
        },
        { label: 'Show in Explorer', click: () => send(getWin(), 'show-in-folder') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Check Spelling', accelerator: 'F7', click: () => send(getWin(), 'toggle-spell') }
      ]
    },
    {
      label: '&View',
      submenu: [
        {
          label: 'Properties Panel',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => send(getWin(), 'toggle-panel')
        },
        {
          label: 'Preview SKILL.md',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send(getWin(), 'toggle-preview')
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        ...(is.dev
          ? [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }]
          : [])
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Skills documentation',
          click: () => shell.openExternal('https://code.claude.com/docs/en/skills')
        },
        { type: 'separator' },
        { label: `About Skilled ${app.getVersion()}`, click: () => send(getWin(), 'about') }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
