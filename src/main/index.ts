import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'

function createWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
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
