import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { loadWindowState, saveWindowState } from './window-state'
import log from './logger'

app.name = 'Axonize'

let saveTimeout: ReturnType<typeof setTimeout> | null = null

function debouncedSave(win: BrowserWindow) {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (win.isDestroyed()) return
    const bounds = win.getBounds()
    saveWindowState({ ...bounds, maximized: win.isMaximized() })
  }, 300)
}

function createWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const state = loadWindowState()

  const win = new BrowserWindow({
    title: 'Axonize',
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (state.maximized) win.maximize()

  win.on('resize', () => debouncedSave(win))
  win.on('move', () => debouncedSave(win))
  win.on('close', () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    const bounds = win.getBounds()
    saveWindowState({ ...bounds, maximized: win.isMaximized() })
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  log.info('Axonize starting...')
  const iconPath = join(__dirname, '../../resources/icon.png')
  if (process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
