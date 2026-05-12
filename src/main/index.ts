import { app, BrowserWindow, ipcMain, Menu, nativeImage, protocol, session, shell } from 'electron'
import { join, extname } from 'path'
import { readFile } from 'fs/promises'
import { registerIpcHandlers } from './ipc-handlers'
import { loadWindowState, saveWindowState, loadWindowSessions, saveWindowSessions, type WindowSession } from './window-state'
import { vaultNameFromPath } from '../core/vault/name'
import log from './logger'

protocol.registerSchemesAsPrivileged([
  { scheme: 'axonize-file', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
}

async function handleAxonizeFileRequest(request: Request): Promise<Response> {
  try {
    const filePath = decodeURIComponent(new URL(request.url).pathname)
    const data = await readFile(filePath)
    const mime = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    return new Response(data, { headers: { 'content-type': mime } })
  } catch {
    return new Response(null, { status: 404 })
  }
}

const APP_NAME = 'Axonize'
app.name = APP_NAME

// Track window -> vault associations for session restore
const windowVaults = new Map<BrowserWindow, string | null>()

// Track if app is quitting to avoid saving incomplete session state
let isQuitting = false

let saveTimeout: ReturnType<typeof setTimeout> | null = null

function debouncedSave(win: BrowserWindow) {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (win.isDestroyed()) return
    const bounds = win.getBounds()
    saveWindowState({ ...bounds, maximized: win.isMaximized() })
  }, 300)
}

// Save all window sessions atomically
function saveAllWindowSessions(): void {
  const windows = BrowserWindow.getAllWindows()
  const sessions: WindowSession[] = windows
    .filter((win) => !win.isDestroyed())
    .map((win) => ({
      state: { ...win.getBounds(), maximized: win.isMaximized() },
      vaultPath: windowVaults.get(win) ?? null
    }))
  saveWindowSessions(sessions)
}

// Debounced session save
let sessionSaveTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedSaveAllSessions(): void {
  if (sessionSaveTimeout) clearTimeout(sessionSaveTimeout)
  sessionSaveTimeout = setTimeout(saveAllWindowSessions, 500)
}

const WINDOW_OFFSET_PX = 30

interface CreateWindowOptions {
  vaultPath?: string
  state?: { x?: number; y?: number; width: number; height: number; maximized?: boolean }
}

function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const { vaultPath, state: providedState } = options
  const iconPath = join(__dirname, '../../resources/icon.png')
  const state = providedState ?? loadWindowState()

  const existingWindows = BrowserWindow.getAllWindows().length
  const offset = providedState ? 0 : existingWindows * WINDOW_OFFSET_PX

  const win = new BrowserWindow({
    title: APP_NAME,
    width: state.width,
    height: state.height,
    x: (state.x ?? 0) + offset,
    y: (state.y ?? 0) + offset,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Track vault association
  windowVaults.set(win, vaultPath ?? null)

  if (state.maximized && existingWindows === 0) win.maximize()

  // Prevent the HTML <title> from overriding our window title (fixes dev mode showing "Electron")
  win.on('page-title-updated', (e) => e.preventDefault())

  win.on('resize', () => {
    debouncedSave(win)
    debouncedSaveAllSessions()
  })
  win.on('move', () => {
    debouncedSave(win)
    debouncedSaveAllSessions()
  })
  win.on('close', () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    const bounds = win.getBounds()
    saveWindowState({ ...bounds, maximized: win.isMaximized() })
    // Don't save sessions here if app is quitting - before-quit handles that
    // Only save when user closes individual windows during normal operation
    if (!isQuitting) {
      // Remove this window from tracking before saving
      windowVaults.delete(win)
      saveAllWindowSessions()
    }
  })
  win.on('closed', () => {
    // Clean up in case close handler didn't run (e.g., during quit)
    windowVaults.delete(win)
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

  const hash = vaultPath ? `#vault=${encodeURIComponent(vaultPath)}` : ''

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: vaultPath ? `vault=${encodeURIComponent(vaultPath)}` : undefined
    })
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
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  ipcMain.handle('window:setTitle', (event, vaultName: string | null) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const title = vaultName ? `${vaultName} — ${APP_NAME}` : APP_NAME
    win.setTitle(title)
  })

  ipcMain.handle('window:openNew', (_event, vaultPath?: string) => {
    createWindow({ vaultPath })
    // Save immediately - important state change, don't risk losing it
    saveAllWindowSessions()
  })

  // Allow renderer to report which vault it opened (for session restore tracking)
  ipcMain.handle('window:setVault', (event, vaultPath: string | null) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    windowVaults.set(win, vaultPath)
    // Save immediately - important state change, don't risk losing it
    saveAllWindowSessions()
  })

  // Enumerate every live Axonize window with its vault path, flagging the caller's own window.
  ipcMain.handle('window:listOpen', (event) => {
    const callerId = BrowserWindow.fromWebContents(event.sender)?.id
    return BrowserWindow.getAllWindows()
      .filter((w) => !w.isDestroyed())
      .map((w) => {
        const vaultPath = windowVaults.get(w) ?? null
        return {
          windowId: w.id,
          vaultPath,
          vaultName: vaultPath ? vaultNameFromPath(vaultPath) : null,
          isCurrent: w.id === callerId
        }
      })
  })

  ipcMain.handle('window:focus', (_event, windowId: number) => {
    const target = BrowserWindow.getAllWindows().find((w) => w.id === windowId && !w.isDestroyed())
    if (!target) return
    if (target.isMinimized()) target.restore()
    target.focus()
  })

  session.defaultSession.protocol.handle('axonize-file', handleAxonizeFileRequest)

  registerIpcHandlers()

  // Restore previous window sessions or create a single new window
  const sessions = loadWindowSessions()
  if (sessions.length > 0) {
    log.info(`Restoring ${sessions.length} window session(s)`)
    for (const sess of sessions) {
      createWindow({ vaultPath: sess.vaultPath ?? undefined, state: sess.state })
    }
  } else {
    createWindow()
  }
  // Save immediately after creating windows to ensure state is persisted
  saveAllWindowSessions()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Save sessions before quitting
app.on('before-quit', () => {
  isQuitting = true
  saveAllWindowSessions()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
