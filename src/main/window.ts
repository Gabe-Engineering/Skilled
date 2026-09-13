import { BrowserWindow, nativeTheme, screen, shell } from 'electron'
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

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** True when enough of the saved window overlaps a display that the user can grab it. */
function boundsAreVisible(b: Bounds): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return (
      b.x + b.width > a.x + 40 &&
      b.x < a.x + a.width - 40 &&
      b.y >= a.y - 10 &&
      b.y < a.y + a.height - 40
    )
  })
}

/**
 * Clamp against the display the window was actually saved on, not the primary
 * one. Clamping a second-monitor window to primary-display coordinates threw it
 * back onto the main screen (and negative-x monitors were clamped to 0).
 */
function clampToDisplay(b: Bounds): Bounds {
  const work = screen.getDisplayMatching(b).workArea
  const width = Math.min(b.width, work.width)
  const height = Math.min(b.height, work.height)
  return {
    width,
    height,
    x: Math.min(Math.max(b.x, work.x), work.x + work.width - width),
    y: Math.min(Math.max(b.y, work.y), work.y + work.height - height)
  }
}

export function createMainWindow(): BrowserWindow {
  const state = store.get()
  const saved = state.windowBounds
  const useSaved = saved && boundsAreVisible(saved)
  const work = screen.getPrimaryDisplay().workAreaSize
  const placed = useSaved ? clampToDisplay(saved) : null

  const win = new BrowserWindow({
    width: placed ? placed.width : Math.min(1280, Math.max(800, work.width - 40)),
    height: placed ? placed.height : Math.min(860, Math.max(500, work.height - 40)),
    x: placed ? placed.x : undefined,
    y: placed ? placed.y : undefined,
    minWidth: 800,
    minHeight: 500,
    show: false,
    title: 'Skilled',
    autoHideMenuBar: true,
    // Matches the renderer's --canvas token so the first paint does not flash.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#17191d' : '#e4e6ea',
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

  // Links come from whatever SKILL.md the user opened, so hand the OS only the
  // two schemes a documentation link can legitimately use.
  win.webContents.setWindowOpenHandler((details) => {
    let protocol = ''
    try {
      protocol = new URL(details.url).protocol
    } catch {
      protocol = ''
    }
    if (protocol === 'http:' || protocol === 'https:') shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Nothing in the app navigates; a stray link must never replace the UI itself.
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
