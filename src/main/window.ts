import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '@shared/ipc'
import { store } from './store'
import { installContextMenu } from './context-menu'

let mainWindow: BrowserWindow | null = null
let forceClose = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function allowClose(): void {
  forceClose = true
}

function boundsAreVisible(b: { x: number; y: number; width: number; height: number }): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x + b.width > a.x + 40 && b.x < a.x + a.width - 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40
  })
}

export function createMainWindow(): BrowserWindow {
  const state = store.get()
  const saved = state.windowBounds
  const useSaved = saved && boundsAreVisible(saved)
  const work = screen.getPrimaryDisplay().workAreaSize
  const defaultWidth = Math.min(1280, Math.max(800, work.width - 40))
  const defaultHeight = Math.min(860, Math.max(500, work.height - 40))

  const win = new BrowserWindow({
    width: useSaved ? Math.min(saved.width, work.width) : defaultWidth,
    height: useSaved ? Math.min(saved.height, work.height) : defaultHeight,
    x: useSaved ? Math.max(0, Math.min(saved.x, work.width - 200)) : undefined,
    y: useSaved ? Math.max(0, Math.min(saved.y, work.height - 100)) : undefined,
    minWidth: 800,
    minHeight: 500,
    show: false,
    title: 'Skilled',
    autoHideMenuBar: true,
    backgroundColor: '#e9e9ec',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })
  mainWindow = win
  forceClose = false

  const ses = win.webContents.session
  ses.on('spellcheck-dictionary-download-begin', (_e, lang) =>
    console.log(`[spell] downloading dictionary ${lang}`)
  )
  ses.on('spellcheck-dictionary-download-success', (_e, lang) =>
    console.log(`[spell] dictionary ready ${lang}`)
  )
  ses.on('spellcheck-dictionary-download-failure', (_e, lang) =>
    console.warn(`[spell] dictionary download failed ${lang}`)
  )
  ses.on('spellcheck-dictionary-initialized', (_e, lang) =>
    console.log(`[spell] dictionary initialized ${lang}`)
  )
  try {
    ses.setSpellCheckerLanguages([state.spellLang || 'en-US'])
  } catch {
    ses.setSpellCheckerLanguages(['en-US'])
  }
  ses.setSpellCheckerEnabled(state.spellcheckOn)
  console.log(
    `[spell] languages=${ses.getSpellCheckerLanguages().join(',')} enabled=${ses.isSpellCheckerEnabled()} available=${ses.availableSpellCheckerLanguages.length}`
  )

  installContextMenu(win)

  win.on('ready-to-show', () => {
    if (state.isMaximized) win.maximize()
    win.show()
  })

  let boundsTimer: NodeJS.Timeout | null = null
  const saveBounds = (): void => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const isMaximized = win.isMaximized()
      const patch: Parameters<typeof store.set>[0] = { isMaximized }
      if (!isMaximized && !win.isMinimized()) patch.windowBounds = win.getNormalBounds()
      store.set(patch)
    }, 300)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)
  win.on('maximize', saveBounds)
  win.on('unmaximize', saveBounds)

  win.on('close', (e) => {
    if (forceClose) return
    e.preventDefault()
    win.webContents.send(IPC.appRequestClose, {})
  })

  win.on('closed', () => {
    mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
