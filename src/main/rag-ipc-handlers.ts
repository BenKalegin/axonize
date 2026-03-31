import { BrowserWindow, ipcMain } from 'electron'
import { getSettings, saveSettings } from './settings-service'
import { incrementalReindex, fullReindex, reindexFile, purgeFolder } from './rag/indexing-service'
import { executeQuery } from './rag/query-service'
import { loadIndexState } from './rag/embedding-store'
import type { AppSettings } from '../core/rag/types'

const vaultPathByWindow = new Map<number, string>()

export function setCurrentVaultPath(path: string, windowId?: number): void {
  if (windowId != null) {
    vaultPathByWindow.set(windowId, path)
  }
}

function resolveVaultPath(event: Electron.IpcMainInvokeEvent, payload?: { vaultPath?: string }): string {
  const path = payload?.vaultPath || vaultPathByWindow.get(event.sender.id) || ''
  if (!path) {
    throw new Error('No vault path set. Open a vault first.')
  }
  return path
}

export function registerRAGIpcHandlers(): void {
  ipcMain.handle('rag:indexVault', async (event, payload?: { vaultPath?: string }) => {
    const vaultPath = resolveVaultPath(event, payload)
    const win = BrowserWindow.fromWebContents(event.sender)
    return incrementalReindex(vaultPath, win)
  })

  ipcMain.handle('rag:fullReindex', async (event, payload?: { vaultPath?: string }) => {
    const vaultPath = resolveVaultPath(event, payload)
    const win = BrowserWindow.fromWebContents(event.sender)
    return fullReindex(vaultPath, win)
  })

  ipcMain.handle('rag:reindexFile', async (event, payload: { vaultPath?: string; filePath: string }) => {
    const vaultPath = resolveVaultPath(event, payload)
    const win = BrowserWindow.fromWebContents(event.sender)
    return reindexFile(vaultPath, payload.filePath, win)
  })

  ipcMain.handle('rag:purgeFolder', async (event, payload: { vaultPath?: string; folderPath: string }) => {
    const vaultPath = resolveVaultPath(event, payload)
    return purgeFolder(vaultPath, payload.folderPath)
  })

  ipcMain.handle('rag:getStatus', async (event) => {
    const path = vaultPathByWindow.get(event.sender.id) || ''
    if (!path) {
      return { version: 0, modelId: '', dimensions: 0, chunkCount: 0, fileHashes: {} }
    }
    const state = await loadIndexState(path)
    return state ?? { version: 0, modelId: '', dimensions: 0, chunkCount: 0, fileHashes: {} }
  })

  ipcMain.handle('rag:query', async (event, payload: { vaultPath?: string; question: string }) => {
    const vaultPath = resolveVaultPath(event, payload)
    return executeQuery(vaultPath, payload.question)
  })

  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:save', async (_event, payload: { settings: AppSettings }) => {
    await saveSettings(payload.settings)
    return { ok: true }
  })
}
