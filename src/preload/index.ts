import { contextBridge, ipcRenderer } from 'electron'

export interface RecentVault {
  path: string
  name: string
  openedAt: number
}

export interface GeneratedDocSource {
  filePath: string
  startLine: number
  headingPath: string[]
  score: number
  contentPreview: string
}

export interface GeneratedDocMeta {
  id: string
  title: string
  query: string
  createdAt: string
  filePath: string
  sources: GeneratedDocSource[]
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

export type { GitStatus, GitFileStatus } from '../core/git/types'

export interface AxonizeAPI {
  window: {
    setTitle: (vaultName: string | null) => Promise<void>
    openNew: (vaultPath?: string) => Promise<void>
  }
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
    write: (filePath: string, content: string) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    delete: (filePath: string) => Promise<void>
    getRecent: (vaultPath: string) => Promise<Array<{ path: string; openedAt: number }>>
    addRecent: (vaultPath: string, filePath: string) => Promise<void>
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
  llm: {
    rewriteSection: (section: string, instruction: string) => Promise<string>
  }
  agent: {
    chat: (payload: {
      prompt: string
      context?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      vaultPath?: string
    }) => Promise<{
      answer: string
      model: string
      usage?: { inputTokens: number; outputTokens: number }
    }>
  }
  settings: {
    get: () => Promise<unknown>
    save: (settings: unknown) => Promise<{ ok: boolean }>
  }
  git: {
    isRepo: (cwd: string) => Promise<boolean>
    root: (cwd: string) => Promise<string | null>
    status: (cwd: string) => Promise<GitFileStatus[]>
    diff: (cwd: string, staged: boolean) => Promise<string>
    stage: (cwd: string, filePath: string) => Promise<void>
    unstage: (cwd: string, filePath: string) => Promise<void>
    stageAll: (cwd: string) => Promise<void>
    unstageAll: (cwd: string) => Promise<void>
    commit: (cwd: string, message: string) => Promise<void>
    suggestCommitMessage: (cwd: string) => Promise<string>
  }
  generatedDocs: {
    save: (vaultPath: string, title: string, query: string, answer: string, sources: GeneratedDocSource[]) => Promise<GeneratedDocMeta>
    list: (vaultPath: string) => Promise<GeneratedDocMeta[]>
    rename: (filePath: string, newTitle: string) => Promise<void>
    makePermanent: (filePath: string, targetPath: string) => Promise<void>
    delete: (filePath: string) => Promise<void>
    cleanup: (vaultPath: string) => Promise<number>
    listFolders: (vaultPath: string) => Promise<string[]>
  }
}

const api: AxonizeAPI = {
  window: {
    setTitle: (vaultName: string | null) => ipcRenderer.invoke('window:setTitle', vaultName),
    openNew: (vaultPath?: string) => ipcRenderer.invoke('window:openNew', vaultPath)
  },
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
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('file:rename', oldPath, newPath),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    getRecent: (vaultPath: string) => ipcRenderer.invoke('vault:getRecentFiles', vaultPath),
    addRecent: (vaultPath: string, filePath: string) => ipcRenderer.invoke('vault:addRecentFile', vaultPath, filePath)
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
  llm: {
    rewriteSection: (section: string, instruction: string) =>
      ipcRenderer.invoke('llm:rewriteSection', { section, instruction })
  },
  agent: {
    chat: (payload: {
      prompt: string
      context?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      vaultPath?: string
    }) => ipcRenderer.invoke('agent:chat', payload)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', { settings })
  },
  git: {
    isRepo: (cwd: string) => ipcRenderer.invoke('git:isRepo', { cwd }),
    root: (cwd: string) => ipcRenderer.invoke('git:root', { cwd }),
    status: (cwd: string) => ipcRenderer.invoke('git:status', { cwd }),
    diff: (cwd: string, staged: boolean) => ipcRenderer.invoke('git:diff', { cwd, staged }),
    stage: (cwd: string, filePath: string) => ipcRenderer.invoke('git:stage', { cwd, filePath }),
    unstage: (cwd: string, filePath: string) => ipcRenderer.invoke('git:unstage', { cwd, filePath }),
    stageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', { cwd }),
    unstageAll: (cwd: string) => ipcRenderer.invoke('git:unstageAll', { cwd }),
    commit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', { cwd, message }),
    suggestCommitMessage: (cwd: string) => ipcRenderer.invoke('git:suggestCommitMessage', { cwd })
  },
  generatedDocs: {
    save: (vaultPath: string, title: string, query: string, answer: string, sources: GeneratedDocSource[]) =>
      ipcRenderer.invoke('generated-docs:save', { vaultPath, title, query, answer, sources }),
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
