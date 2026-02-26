import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readVaultFiles } from './file-service'
import { readFile } from 'fs/promises'
import { getRecentVaults, addRecentVault, removeRecentVault } from './recent-vaults-service'
import { registerRAGIpcHandlers, setCurrentVaultPath } from './rag-ipc-handlers'
import { registerGeneratedDocsIpcHandlers } from './generated-docs-ipc-handlers'
import { registerSemanticIpcHandlers } from './semantic-ipc-handlers'
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
      const content = await readFile(filePath, 'utf-8')
      return content
    } catch (e) {
      log.error('file:read failed:', filePath, e)
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

  registerRAGIpcHandlers()
  registerGeneratedDocsIpcHandlers()
  registerSemanticIpcHandlers()
}
