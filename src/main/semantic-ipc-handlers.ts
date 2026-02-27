import { BrowserWindow, ipcMain } from 'electron'
import {
  buildSemanticIndex,
  incrementalSemanticUpdate,
  loadSemanticIndex,
  loadSemanticState,
  estimateSemanticBuild
} from './semantic/decomposition-service'
import log from './logger'

export function registerSemanticIpcHandlers(): void {
  ipcMain.handle('semantic:build', async (_event, payload: { vaultPath: string }) => {
    log.info('[semantic] IPC: build requested for', payload.vaultPath)
    const win = BrowserWindow.getFocusedWindow()
    try {
      const result = await buildSemanticIndex(payload.vaultPath, win)
      log.info('[semantic] Build complete:', result.cardCount, 'cards')
      return result
    } catch (err) {
      log.error('[semantic] Build failed:', err)
      throw err
    }
  })

  ipcMain.handle('semantic:incremental', async (_event, payload: { vaultPath: string }) => {
    log.info('[semantic] IPC: incremental requested for', payload.vaultPath)
    const win = BrowserWindow.getFocusedWindow()
    try {
      const result = await incrementalSemanticUpdate(payload.vaultPath, win)
      log.info('[semantic] Incremental complete:', result.cardCount, 'cards')
      return result
    } catch (err) {
      log.error('[semantic] Incremental failed:', err)
      throw err
    }
  })

  ipcMain.handle('semantic:load', async (_event, payload: { vaultPath: string }) => {
    return loadSemanticIndex(payload.vaultPath)
  })

  ipcMain.handle('semantic:status', async (_event, payload: { vaultPath: string }) => {
    const state = await loadSemanticState(payload.vaultPath)
    return state ?? { version: 0, fileHashes: {} }
  })

  ipcMain.handle('semantic:estimate', async (_event, payload: { vaultPath: string }) => {
    return estimateSemanticBuild(payload.vaultPath)
  })
}
