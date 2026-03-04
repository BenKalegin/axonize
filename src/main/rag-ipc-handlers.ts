import { BrowserWindow, ipcMain } from 'electron'
import { getSettings, saveSettings } from './settings-service'
import { incrementalReindex, fullReindex, reindexFile, purgeFolder } from './rag/indexing-service'
import { executeQuery } from './rag/query-service'
import { loadIndexState } from './rag/embedding-store'
import type { AppSettings } from '../core/rag/types'

let currentVaultPath = ''

export function setCurrentVaultPath(path: string): void {
  currentVaultPath = path
}

function resolveVaultPath(payload?: { vaultPath?: string }): string {
  const path = payload?.vaultPath || currentVaultPath
  if (!path) {
    throw new Error('No vault path set. Open a vault first.')
  }
  return path
}

export function registerRAGIpcHandlers(): void {
  ipcMain.handle('rag:indexVault', async (_event, payload?: { vaultPath?: string }) => {
    const vaultPath = resolveVaultPath(payload)
    const win = BrowserWindow.getFocusedWindow()
    return incrementalReindex(vaultPath, win)
  })

  ipcMain.handle('rag:fullReindex', async (_event, payload?: { vaultPath?: string }) => {
    const vaultPath = resolveVaultPath(payload)
    const win = BrowserWindow.getFocusedWindow()
    return fullReindex(vaultPath, win)
  })

  ipcMain.handle('rag:reindexFile', async (_event, payload: { vaultPath?: string; filePath: string }) => {
    const vaultPath = resolveVaultPath(payload)
    const win = BrowserWindow.getFocusedWindow()
    return reindexFile(vaultPath, payload.filePath, win)
  })

  ipcMain.handle('rag:purgeFolder', async (_event, payload: { vaultPath?: string; folderPath: string }) => {
    const vaultPath = resolveVaultPath(payload)
    return purgeFolder(vaultPath, payload.folderPath)
  })

  ipcMain.handle('rag:getStatus', async () => {
    if (!currentVaultPath) {
      return { version: 0, modelId: '', dimensions: 0, chunkCount: 0, fileHashes: {} }
    }
    const state = await loadIndexState(currentVaultPath)
    return state ?? { version: 0, modelId: '', dimensions: 0, chunkCount: 0, fileHashes: {} }
  })

  ipcMain.handle('rag:query', async (_event, payload: { vaultPath?: string; question: string }) => {
    const vaultPath = resolveVaultPath(payload)
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
