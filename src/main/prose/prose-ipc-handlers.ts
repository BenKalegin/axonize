import { ipcMain } from 'electron'
import log from '../logger'
import { refactorDocument, type RefactorRequest } from './refactor-service'

export function registerProseIpcHandlers(): void {
  ipcMain.handle('prose:refactor', async (_event, payload: RefactorRequest): Promise<string> => {
    try {
      return await refactorDocument(payload)
    } catch (e) {
      log.error('prose:refactor failed:', e)
      throw e
    }
  })
}
