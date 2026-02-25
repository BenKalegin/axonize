import { create } from 'zustand'

export interface LLMLogEntry {
  id: string
  timestamp: number
  question: string
  answer?: string
  error?: string
  sources?: { filePath: string; score: number }[]
  isLoading: boolean
}

interface LLMLogState {
  entries: LLMLogEntry[]
  addEntry: (question: string) => string
  resolveEntry: (id: string, answer: string, sources?: { filePath: string; score: number }[]) => void
  rejectEntry: (id: string, error: string) => void
  clearLog: () => void
}

let nextId = 0

export const useLLMLogStore = create<LLMLogState>((set) => ({
  entries: [],

  addEntry: (question: string) => {
    const id = `llm-${++nextId}`
    const entry: LLMLogEntry = {
      id,
      timestamp: Date.now(),
      question,
      isLoading: true
    }
    set((state) => ({ entries: [entry, ...state.entries] }))
    return id
  },

  resolveEntry: (id, answer, sources) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, answer, sources, isLoading: false } : e
      )
    }))
  },

  rejectEntry: (id, error) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, error, isLoading: false } : e
      )
    }))
  },

  clearLog: () => {
    set({ entries: [] })
  }
}))
