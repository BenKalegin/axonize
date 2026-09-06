import { ipcMain } from 'electron'
import type { FieldFilter } from '../../core/data/row-query'
import {
  closeDataFile,
  getNodeChildren,
  getRows,
  openDataFile,
  queryDataFile,
  searchDataFile
} from './data-file-service'
import log from '../logger'

export function registerDataIpcHandlers(): void {
  ipcMain.handle('data:open', (_event, filePath: string) =>
    logged('data:open', filePath, () => openDataFile(filePath))
  )
  ipcMain.handle('data:rows', (_event, filePath: string, offset: number, limit: number) =>
    logged('data:rows', filePath, () => getRows(filePath, offset, limit))
  )
  ipcMain.handle(
    'data:node',
    (_event, filePath: string, path: Array<string | number>, offset: number, limit: number) =>
      logged('data:node', filePath, () => getNodeChildren(filePath, path, offset, limit))
  )
  ipcMain.handle('data:search', (_event, filePath: string, text: string) =>
    logged('data:search', filePath, () => searchDataFile(filePath, text))
  )
  ipcMain.handle(
    'data:query',
    (
      _event,
      filePath: string,
      filters: FieldFilter[],
      select: string[] | undefined,
      offset: number,
      limit: number
    ) => logged('data:query', filePath, () => queryDataFile(filePath, filters, select, offset, limit))
  )
  ipcMain.handle('data:close', (_event, filePath: string) => {
    closeDataFile(filePath)
  })
}

async function logged<T>(channel: string, filePath: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    log.error(`${channel} failed:`, filePath, e)
    throw e
  }
}
