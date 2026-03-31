import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { loadWindowState, saveWindowState } from './window-state'
import log from './logger'

const APP_NAME = 'Axonize'
app.name = APP_NAME

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

  // Prevent the HTML <title> from overriding our window title (fixes dev mode showing "Electron")
  win.on('page-title-updated', (e) => e.preventDefault())

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

  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? ''
    if (url.startsWith(rendererUrl)) return
    event.preventDefault()
    shell.openExternal(url)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'Axonize',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  log.info('Axonize starting...')
  buildAppMenu()
  const iconPath = join(__dirname, '../../resources/icon.png')
  if (process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  ipcMain.handle('window:setTitle', (_event, vaultName: string | null) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    const title = vaultName ? `${vaultName} — ${APP_NAME}` : APP_NAME
    win.setTitle(title)
  })

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
