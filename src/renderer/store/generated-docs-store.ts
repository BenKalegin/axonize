import { create } from 'zustand'
import type { GeneratedDocMeta } from '../../core/rag/types'

interface GeneratedDocsState {
  docs: GeneratedDocMeta[]
  loadDocs: (vaultPath: string) => Promise<void>
  saveDoc: (vaultPath: string, title: string, query: string, answer: string) => Promise<GeneratedDocMeta>
  renameDoc: (filePath: string, newTitle: string) => Promise<void>
  makePermanent: (filePath: string, targetPath: string) => Promise<void>
  deleteDoc: (filePath: string) => Promise<void>
  runCleanup: (vaultPath: string) => Promise<void>
}

export const useGeneratedDocsStore = create<GeneratedDocsState>((set, get) => ({
  docs: [],

  loadDocs: async (vaultPath: string) => {
    const docs = await window.axonize.generatedDocs.list(vaultPath)
    set({ docs })
  },

  saveDoc: async (vaultPath: string, title: string, query: string, answer: string) => {
    const meta = await window.axonize.generatedDocs.save(vaultPath, title, query, answer)
    set({ docs: [meta, ...get().docs] })
    return meta
  },

  renameDoc: async (filePath: string, newTitle: string) => {
    await window.axonize.generatedDocs.rename(filePath, newTitle)
    set({
      docs: get().docs.map((d) =>
        d.filePath === filePath ? { ...d, title: newTitle } : d
      )
    })
  },

  makePermanent: async (filePath: string, targetPath: string) => {
    await window.axonize.generatedDocs.makePermanent(filePath, targetPath)
    set({ docs: get().docs.filter((d) => d.filePath !== filePath) })
  },

  deleteDoc: async (filePath: string) => {
    await window.axonize.generatedDocs.delete(filePath)
    set({ docs: get().docs.filter((d) => d.filePath !== filePath) })
  },

  runCleanup: async (vaultPath: string) => {
    await window.axonize.generatedDocs.cleanup(vaultPath)
    await get().loadDocs(vaultPath)
  }
}))
