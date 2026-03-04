import { ipcMain } from 'electron'
import {
  saveGeneratedDoc,
  listGeneratedDocs,
  renameGeneratedDoc,
  makePermanent,
  deleteGeneratedDoc,
  cleanupExpiredDocs,
  listVaultFolders
} from './generated-docs-service'
import log from './logger'

export function registerGeneratedDocsIpcHandlers(): void {
  ipcMain.handle('generated-docs:save', async (_event, args: { vaultPath: string; title: string; query: string; answer: string }) => {
    try {
      return await saveGeneratedDoc(args.vaultPath, args.title, args.query, args.answer)
    } catch (e) {
      log.error('generated-docs:save failed:', e)
      throw e
    }
  })

  ipcMain.handle('generated-docs:list', async (_event, args: { vaultPath: string }) => {
    try {
      return await listGeneratedDocs(args.vaultPath)
    } catch (e) {
      log.error('generated-docs:list failed:', e)
      throw e
    }
  })

  ipcMain.handle('generated-docs:rename', async (_event, args: { filePath: string; newTitle: string }) => {
    try {
      await renameGeneratedDoc(args.filePath, args.newTitle)
    } catch (e) {
      log.error('generated-docs:rename failed:', e)
      throw e
    }
  })

  ipcMain.handle('generated-docs:makePermanent', async (_event, args: { filePath: string; targetPath: string }) => {
    try {
      await makePermanent(args.filePath, args.targetPath)
    } catch (e) {
      log.error('generated-docs:makePermanent failed:', e)
      throw e
    }
  })

  ipcMain.handle('generated-docs:delete', async (_event, args: { filePath: string }) => {
    try {
      await deleteGeneratedDoc(args.filePath)
    } catch (e) {
      log.error('generated-docs:delete failed:', e)
      throw e
    }
  })

  ipcMain.handle('generated-docs:cleanup', async (_event, args: { vaultPath: string }) => {
    try {
      return await cleanupExpiredDocs(args.vaultPath)
    } catch (e) {
      log.error('generated-docs:cleanup failed:', e)
      throw e
    }
  })

  ipcMain.handle('generated-docs:listFolders', async (_event, args: { vaultPath: string }) => {
    try {
      return await listVaultFolders(args.vaultPath)
    } catch (e) {
      log.error('generated-docs:listFolders failed:', e)
      throw e
    }
  })
}
