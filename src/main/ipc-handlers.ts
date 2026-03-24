import {BrowserWindow, dialog, ipcMain} from 'electron'
import {readVaultFiles} from './file-service'
import {mkdir, readFile, writeFile, rename, unlink} from 'fs/promises'
import {join} from 'path'
import {addRecentVault, getRecentVaults, removeRecentVault} from './recent-vaults-service'
import {registerRAGIpcHandlers, setCurrentVaultPath} from './rag-ipc-handlers'
import {registerGeneratedDocsIpcHandlers} from './generated-docs-ipc-handlers'
import {registerSemanticIpcHandlers} from './semantic-ipc-handlers'
import {registerLLMIpcHandlers} from './llm-ipc-handlers'
import {startWatching, stopWatching} from './file-watcher'
import log from './logger'

const DOC_SLUGS = new Set(['doc', 'docs'])

function vaultNameFromPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  const last = parts.at(-1) || p
  if (DOC_SLUGS.has(last.toLowerCase()) && parts.length >= 2) {
    return parts.at(-2)!
  }
  return last
}

export function registerIpcHandlers(): void {
  ipcMain.handle('vault:open', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Open Vault'
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const vaultPath = result.filePaths[0]
    const name = vaultNameFromPath(vaultPath)
    await addRecentVault(vaultPath, name)
    setCurrentVaultPath(vaultPath)
    return vaultPath
  })

  ipcMain.handle('vault:readFiles', async (_event, vaultPath: string) => {
    try {
      setCurrentVaultPath(vaultPath)
      return readVaultFiles(vaultPath)
    } catch (e) {
      log.error('vault:readFiles failed:', e)
      throw e
    }
  })

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      return readFile(filePath, 'utf-8')
    } catch (e) {
      log.error('file:read failed:', filePath, e)
      throw e
    }
  })

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content, 'utf-8')
    } catch (e) {
      log.error('file:write failed:', filePath, e)
      throw e
    }
  })

  ipcMain.handle('file:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      await rename(oldPath, newPath)
    } catch (e) {
      log.error('file:rename failed:', oldPath, '->', newPath, e)
      throw e
    }
  })

  ipcMain.handle('file:delete', async (_event, filePath: string) => {
    try {
      await unlink(filePath)
    } catch (e) {
      log.error('file:delete failed:', filePath, e)
      throw e
    }
  })

  ipcMain.handle('vault:getRecent', async () => {
    return getRecentVaults()
  })

  ipcMain.handle('vault:addRecent', async (_event, path: string, name: string) => {
    await addRecentVault(path, name)
  })

  ipcMain.handle('vault:removeRecent', async (_event, path: string) => {
    await removeRecentVault(path)
  })

  ipcMain.handle('vault:startWatch', (_event, path: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      startWatching(path, win)
    }
  })

  ipcMain.handle('vault:stopWatch', () => {
    stopWatching()
  })

  const RECENT_FILES_MAX = 10

  ipcMain.handle('vault:getRecentFiles', async (_event, vaultPath: string) => {
    try {
      const filePath = join(vaultPath, '.axonize', 'recent-files.json')
      const data = await readFile(filePath, 'utf-8')
      return JSON.parse(data) as Array<{ path: string; openedAt: number }>
    } catch {
      return []
    }
  })

  ipcMain.handle('vault:addRecentFile', async (_event, vaultPath: string, filePath: string) => {
    const jsonPath = join(vaultPath, '.axonize', 'recent-files.json')
    let entries: Array<{ path: string; openedAt: number }> = []
    try {
      const data = await readFile(jsonPath, 'utf-8')
      entries = JSON.parse(data)
    } catch { /* no file yet */ }

    entries = entries.filter((e) => e.path !== filePath)
    entries.unshift({ path: filePath, openedAt: Date.now() })
    entries = entries.slice(0, RECENT_FILES_MAX)

    await mkdir(join(vaultPath, '.axonize'), { recursive: true })
    await writeFile(jsonPath, JSON.stringify(entries, null, 2), 'utf-8')
  })

  registerRAGIpcHandlers()
  registerGeneratedDocsIpcHandlers()
  registerSemanticIpcHandlers()
  registerLLMIpcHandlers()
}
