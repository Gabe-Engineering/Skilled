import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { store } from './store'
import { createMainWindow, getMainWindow } from './window'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.skilled.app')
    store.init()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpc()
    buildMenu(getMainWindow)
    store.onChange(() => buildMenu(getMainWindow))
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('before-quit', () => store.flush())

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
