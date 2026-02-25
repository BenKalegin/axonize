import { contextBridge, ipcRenderer } from 'electron'

export interface RecentVault {
  path: string
  name: string
  openedAt: number
}

export interface AxonizeAPI {
  vault: {
    open: () => Promise<string | null>
    readFiles: (vaultPath: string) => Promise<unknown[]>
    getRecent: () => Promise<RecentVault[]>
    addRecent: (path: string, name: string) => Promise<void>
    removeRecent: (path: string) => Promise<void>
  }
  file: {
    read: (filePath: string) => Promise<string>
  }
  rag: {
    indexVault: (vaultPath: string) => Promise<{ chunkCount: number }>
    fullReindex: (vaultPath: string) => Promise<{ chunkCount: number }>
    reindexFile: (vaultPath: string, filePath: string) => Promise<{ chunkCount: number }>
    getStatus: () => Promise<{ version: number; modelId: string; dimensions: number; chunkCount: number; fileHashes: Record<string, string> }>
    query: (vaultPath: string, question: string) => Promise<{ answer: string; sources: Array<{ filePath: string; startLine: number; headingPath: string[]; score: number; contentPreview: string }> }>
    onIndexProgress: (callback: (payload: unknown) => void) => () => void
  }
  settings: {
    get: () => Promise<unknown>
    save: (settings: unknown) => Promise<{ ok: boolean }>
  }
}

const api: AxonizeAPI = {
  vault: {
    open: () => ipcRenderer.invoke('vault:open'),
    readFiles: (vaultPath: string) => ipcRenderer.invoke('vault:readFiles', vaultPath),
    getRecent: () => ipcRenderer.invoke('vault:getRecent'),
    addRecent: (path: string, name: string) => ipcRenderer.invoke('vault:addRecent', path, name),
    removeRecent: (path: string) => ipcRenderer.invoke('vault:removeRecent', path)
  },
  file: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath)
  },
  rag: {
    indexVault: (vaultPath: string) => ipcRenderer.invoke('rag:indexVault', { vaultPath }),
    fullReindex: (vaultPath: string) => ipcRenderer.invoke('rag:fullReindex', { vaultPath }),
    reindexFile: (vaultPath: string, filePath: string) => ipcRenderer.invoke('rag:reindexFile', { vaultPath, filePath }),
    getStatus: () => ipcRenderer.invoke('rag:getStatus'),
    query: (vaultPath: string, question: string) => ipcRenderer.invoke('rag:query', { vaultPath, question }),
    onIndexProgress: (callback: (payload: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => callback(payload)
      ipcRenderer.on('rag:indexProgress', listener)
      return () => {
        ipcRenderer.removeListener('rag:indexProgress', listener)
      }
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', { settings })
  }
}

contextBridge.exposeInMainWorld('axonize', api)
