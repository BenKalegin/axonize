import { BrowserWindow, ipcMain } from 'electron'
import {
  buildSemanticIndex,
  incrementalSemanticUpdate,
  loadSemanticIndex,
  loadSemanticState,
  estimateSemanticBuild,
  loadCards,
  SEMANTIC_VERSION
} from './semantic/decomposition-service'
import { loadSummaryVectors } from './semantic/summary-embeddings'
import { cosineSimilarity } from '../core/rag/vector-math'
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
    return {
      appVersion: SEMANTIC_VERSION,
      vaultVersion: state?.version ?? 0,
      needsReindex: !state || state.version < SEMANTIC_VERSION,
      fileHashes: state?.fileHashes ?? {}
    }
  })

  ipcMain.handle('semantic:estimate', async (_event, payload: { vaultPath: string }) => {
    return estimateSemanticBuild(payload.vaultPath)
  })

  ipcMain.handle('semantic:distances', async (_event, payload: {
    vaultPath: string
    anchorCardId: string
    targetLevel?: number
  }) => {
    const data = await loadSummaryVectors(payload.vaultPath)
    if (!data) return {}

    const { cardIds, vectors, dims } = data
    const anchorIndex = cardIds.indexOf(payload.anchorCardId)
    if (anchorIndex === -1) return {}

    const anchorVector = vectors.subarray(anchorIndex * dims, (anchorIndex + 1) * dims) as Float32Array
    const cards = await loadCards(payload.vaultPath)
    const cardLevelMap = new Map(cards.map((c) => [c.id, c.level]))

    const result: Record<string, number> = {}
    for (let i = 0; i < cardIds.length; i++) {
      const id = cardIds[i]
      if (id === payload.anchorCardId) continue
      if (payload.targetLevel != null && cardLevelMap.get(id) !== payload.targetLevel) continue
      const targetVector = vectors.subarray(i * dims, (i + 1) * dims) as Float32Array
      result[id] = cosineSimilarity(anchorVector, targetVector)
    }
    return result
  })
}
