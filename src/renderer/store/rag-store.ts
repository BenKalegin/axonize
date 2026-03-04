import { create } from 'zustand'
import { useLLMLogStore } from './llm-log-store'
import { useGeneratedDocsStore } from './generated-docs-store'

interface RAGSource {
  filePath: string
  startLine: number
  headingPath: string[]
  score: number
  contentPreview: string
}

interface RAGResponse {
  answer: string
  suggestedTitle: string
  sources: RAGSource[]
}

interface IndexProgress {
  phase: 'scanning' | 'extracting' | 'embedding' | 'saving' | 'done'
  current: number
  total: number
  file?: string
}

interface RagState {
  isIndexing: boolean
  indexProgress: IndexProgress | null
  chunkCount: number
  isQuerying: boolean
  lastResponse: RAGResponse | null
  queryError: string | null

  indexVault: (vaultPath: string) => Promise<void>
  fullReindex: (vaultPath: string) => Promise<void>
  reindexFile: (vaultPath: string, filePath: string) => Promise<void>
  query: (vaultPath: string, question: string) => Promise<void>
  updateProgress: (progress: IndexProgress) => void
  updateStatus: () => Promise<void>
  clearResponse: () => void
}

export const useRagStore = create<RagState>((set, get) => ({
  isIndexing: false,
  indexProgress: null,
  chunkCount: 0,
  isQuerying: false,
  lastResponse: null,
  queryError: null,

  indexVault: async (vaultPath: string) => {
    set({ isIndexing: true, queryError: null })
    try {
      const result = await window.axonize.rag.indexVault(vaultPath)
      set({ chunkCount: result.chunkCount })
    } catch (e) {
      console.error('RAG index failed:', e)
    } finally {
      set({ isIndexing: false })
    }
  },

  fullReindex: async (vaultPath: string) => {
    set({ isIndexing: true, queryError: null })
    try {
      const result = await window.axonize.rag.fullReindex(vaultPath)
      set({ chunkCount: result.chunkCount })
    } catch (e) {
      console.error('RAG full reindex failed:', e)
    } finally {
      set({ isIndexing: false })
    }
  },

  reindexFile: async (vaultPath: string, filePath: string) => {
    set({ isIndexing: true, queryError: null })
    try {
      const result = await window.axonize.rag.reindexFile(vaultPath, filePath)
      set({ chunkCount: result.chunkCount })
    } catch (e) {
      console.error('RAG reindex file failed:', e)
    } finally {
      set({ isIndexing: false })
    }
  },

  query: async (vaultPath: string, question: string) => {
    set({ isQuerying: true, queryError: null })
    const logId = useLLMLogStore.getState().addEntry(question)
    try {
      const result = await window.axonize.rag.query(vaultPath, question)
      set({ lastResponse: result })
      useLLMLogStore.getState().resolveEntry(
        logId,
        result.answer,
        result.sources.map((s: RAGSource) => ({ filePath: s.filePath, score: s.score }))
      )
      useGeneratedDocsStore.getState().saveDoc(
        vaultPath,
        result.suggestedTitle,
        question,
        result.answer
      ).catch(() => { /* best-effort save */ })
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      set({ queryError: errorMsg })
      useLLMLogStore.getState().rejectEntry(logId, errorMsg)
    } finally {
      set({ isQuerying: false })
    }
  },

  updateProgress: (progress: IndexProgress) => {
    set({ indexProgress: progress })
    if (progress.phase === 'done') {
      set({ chunkCount: progress.total, isIndexing: false })
    }
  },

  updateStatus: async () => {
    try {
      const status = await window.axonize.rag.getStatus()
      set({ chunkCount: status.chunkCount })
    } catch {
      // ignore
    }
  },

  clearResponse: () => {
    set({ lastResponse: null, queryError: null })
  }
}))
