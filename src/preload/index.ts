import { contextBridge, ipcRenderer } from 'electron'

export interface RecentVault {
  path: string
  name: string
  openedAt: number
}

export interface GeneratedDocMeta {
  id: string
  title: string
  query: string
  createdAt: string
  filePath: string
}

export interface SemanticLoadResult {
  cards: Array<{
    id: string
    filePath: string
    level: number
    parentId: string | null
    title: string
    summary: string
    childIds: string[]
    startLine: number
    endLine: number
    kind?: string
    facets?: Record<string, string[]>
    hubCategory?: string
    clusterDocIds?: string[]
  }>
  relations: Array<{
    sourceId: string
    targetId: string
    type: string
    label?: string
  }>
  dimensions?: Array<{
    key: string
    label: string
    description: string
  }>
}

export interface SemanticEstimateResult {
  fileCount: number
  totalChars: number
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  cachedFiles: number
  filesToProcess: number
}

export interface RelatedDoc {
  cardId: string
  title: string
  summary: string
  filePath: string
  score: number
}

export interface AxonizeAPI {
  vault: {
    open: () => Promise<string | null>
    readFiles: (vaultPath: string) => Promise<unknown[]>
    getRecent: () => Promise<RecentVault[]>
    addRecent: (path: string, name: string) => Promise<void>
    removeRecent: (path: string) => Promise<void>
    startWatch: (path: string) => Promise<void>
    stopWatch: () => Promise<void>
    onFilesChanged: (callback: () => void) => () => void
  }
  file: {
    read: (filePath: string) => Promise<string>
  }
  rag: {
    indexVault: (vaultPath: string) => Promise<{ chunkCount: number }>
    fullReindex: (vaultPath: string) => Promise<{ chunkCount: number }>
    reindexFile: (vaultPath: string, filePath: string) => Promise<{ chunkCount: number }>
    getStatus: () => Promise<{ version: number; modelId: string; dimensions: number; chunkCount: number; fileHashes: Record<string, string> }>
    query: (vaultPath: string, question: string) => Promise<{ answer: string; suggestedTitle: string; sources: Array<{ filePath: string; startLine: number; headingPath: string[]; score: number; contentPreview: string }> }>
    purgeFolder: (vaultPath: string, folderPath: string) => Promise<{ chunkCount: number }>
    onIndexProgress: (callback: (payload: unknown) => void) => () => void
  }
  semantic: {
    build: (vaultPath: string) => Promise<{ cardCount: number }>
    incremental: (vaultPath: string) => Promise<{ cardCount: number }>
    load: (vaultPath: string) => Promise<SemanticLoadResult>
    status: (vaultPath: string) => Promise<{ appVersion: number; vaultVersion: number; needsReindex: boolean; fileHashes: Record<string, string> }>
    estimate: (vaultPath: string) => Promise<SemanticEstimateResult>
    distances: (vaultPath: string, anchorCardId: string, targetLevel?: number) => Promise<Record<string, number>>
    relatedDocs: (vaultPath: string, filePath: string, k?: number) => Promise<RelatedDoc[]>
    onProgress: (callback: (payload: unknown) => void) => () => void
    onError: (callback: (payload: unknown) => void) => () => void
    onErrorsClear: (callback: () => void) => () => void
  }
  settings: {
    get: () => Promise<unknown>
    save: (settings: unknown) => Promise<{ ok: boolean }>
  }
  generatedDocs: {
    save: (vaultPath: string, title: string, query: string, answer: string) => Promise<GeneratedDocMeta>
    list: (vaultPath: string) => Promise<GeneratedDocMeta[]>
    rename: (filePath: string, newTitle: string) => Promise<void>
    makePermanent: (filePath: string, targetPath: string) => Promise<void>
    delete: (filePath: string) => Promise<void>
    cleanup: (vaultPath: string) => Promise<number>
    listFolders: (vaultPath: string) => Promise<string[]>
  }
}

const api: AxonizeAPI = {
  vault: {
    open: () => ipcRenderer.invoke('vault:open'),
    readFiles: (vaultPath: string) => ipcRenderer.invoke('vault:readFiles', vaultPath),
    getRecent: () => ipcRenderer.invoke('vault:getRecent'),
    addRecent: (path: string, name: string) => ipcRenderer.invoke('vault:addRecent', path, name),
    removeRecent: (path: string) => ipcRenderer.invoke('vault:removeRecent', path),
    startWatch: (path: string) => ipcRenderer.invoke('vault:startWatch', path),
    stopWatch: () => ipcRenderer.invoke('vault:stopWatch'),
    onFilesChanged: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('vault:filesChanged', listener)
      return () => {
        ipcRenderer.removeListener('vault:filesChanged', listener)
      }
    }
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
    purgeFolder: (vaultPath: string, folderPath: string) => ipcRenderer.invoke('rag:purgeFolder', { vaultPath, folderPath }),
    onIndexProgress: (callback: (payload: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => callback(payload)
      ipcRenderer.on('rag:indexProgress', listener)
      return () => {
        ipcRenderer.removeListener('rag:indexProgress', listener)
      }
    }
  },
  semantic: {
    build: (vaultPath: string) => ipcRenderer.invoke('semantic:build', { vaultPath }),
    incremental: (vaultPath: string) => ipcRenderer.invoke('semantic:incremental', { vaultPath }),
    load: (vaultPath: string) => ipcRenderer.invoke('semantic:load', { vaultPath }),
    status: (vaultPath: string) => ipcRenderer.invoke('semantic:status', { vaultPath }),
    estimate: (vaultPath: string) => ipcRenderer.invoke('semantic:estimate', { vaultPath }),
    distances: (vaultPath: string, anchorCardId: string, targetLevel?: number) =>
      ipcRenderer.invoke('semantic:distances', { vaultPath, anchorCardId, targetLevel }),
    relatedDocs: (vaultPath: string, filePath: string, k?: number) =>
      ipcRenderer.invoke('semantic:relatedDocs', { vaultPath, filePath, k }),
    onProgress: (callback: (payload: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => callback(payload)
      ipcRenderer.on('semantic:progress', listener)
      return () => {
        ipcRenderer.removeListener('semantic:progress', listener)
      }
    },
    onError: (callback: (payload: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => callback(payload)
      ipcRenderer.on('semantic:error', listener)
      return () => {
        ipcRenderer.removeListener('semantic:error', listener)
      }
    },
    onErrorsClear: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('semantic:errors-clear', listener)
      return () => {
        ipcRenderer.removeListener('semantic:errors-clear', listener)
      }
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', { settings })
  },
  generatedDocs: {
    save: (vaultPath: string, title: string, query: string, answer: string) =>
      ipcRenderer.invoke('generated-docs:save', { vaultPath, title, query, answer }),
    list: (vaultPath: string) =>
      ipcRenderer.invoke('generated-docs:list', { vaultPath }),
    rename: (filePath: string, newTitle: string) =>
      ipcRenderer.invoke('generated-docs:rename', { filePath, newTitle }),
    makePermanent: (filePath: string, targetPath: string) =>
      ipcRenderer.invoke('generated-docs:makePermanent', { filePath, targetPath }),
    delete: (filePath: string) =>
      ipcRenderer.invoke('generated-docs:delete', { filePath }),
    cleanup: (vaultPath: string) =>
      ipcRenderer.invoke('generated-docs:cleanup', { vaultPath }),
    listFolders: (vaultPath: string) =>
      ipcRenderer.invoke('generated-docs:listFolders', { vaultPath })
  }
}

contextBridge.exposeInMainWorld('axonize', api)
