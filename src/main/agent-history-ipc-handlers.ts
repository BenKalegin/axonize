import { ipcMain } from 'electron'
import {
  saveAgentTurn,
  deleteAgentSession,
  deleteAgentTurns,
  promoteAgentTurn,
  cleanupExpiredAgentTurns
} from './agent-history-service'
import type { SaveAgentTurnPayload } from '../core/agent/history-types'
import log from './logger'

export function registerAgentHistoryIpcHandlers(): void {
  ipcMain.handle(
    'agent-history:save',
    async (_event, args: { vaultPath: string; payload: SaveAgentTurnPayload }) => {
      try {
        return await saveAgentTurn(args.vaultPath, args.payload)
      } catch (e) {
        log.error('agent-history:save failed:', e)
        throw e
      }
    }
  )

  ipcMain.handle(
    'agent-history:deleteSession',
    async (_event, args: { vaultPath: string; sessionId: string }) => {
      try {
        await deleteAgentSession(args.vaultPath, args.sessionId)
      } catch (e) {
        log.error('agent-history:deleteSession failed:', e)
        throw e
      }
    }
  )

  ipcMain.handle(
    'agent-history:deleteTurns',
    async (_event, args: { vaultPath: string; sessionId: string; turnIds: string[] }) => {
      try {
        await deleteAgentTurns(args.vaultPath, args.sessionId, args.turnIds)
      } catch (e) {
        log.error('agent-history:deleteTurns failed:', e)
        throw e
      }
    }
  )

  ipcMain.handle(
    'agent-history:promote',
    async (_event, args: { filePath: string; targetPath: string }) => {
      try {
        await promoteAgentTurn(args.filePath, args.targetPath)
      } catch (e) {
        log.error('agent-history:promote failed:', e)
        throw e
      }
    }
  )

  ipcMain.handle('agent-history:cleanup', async (_event, args: { vaultPath: string }) => {
    try {
      return await cleanupExpiredAgentTurns(args.vaultPath)
    } catch (e) {
      log.error('agent-history:cleanup failed:', e)
      throw e
    }
  })
}
