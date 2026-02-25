import { create } from 'zustand'

type ViewMode = 'markdown' | 'graph'

interface EditorState {
  viewMode: ViewMode
  selectedFile: string | null
  history: string[]
  historyIndex: number
  canGoBack: boolean
  canGoForward: boolean
  setViewMode: (mode: ViewMode) => void
  selectFile: (path: string) => void
  goBack: () => void
  goForward: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  viewMode: 'markdown',
  selectedFile: null,
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

  selectFile: (path: string) => {
    const { history, historyIndex, selectedFile } = get()
    if (path === selectedFile) return
    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push(path)
    const newIndex = trimmed.length - 1
    set({
      selectedFile: path,
      viewMode: 'markdown',
      history: trimmed,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false
    })
  },

  goBack: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    set({
      selectedFile: history[newIndex],
      viewMode: 'markdown',
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: true
    })
  },

  goForward: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    set({
      selectedFile: history[newIndex],
      viewMode: 'markdown',
      historyIndex: newIndex,
      canGoBack: true,
      canGoForward: newIndex < history.length - 1
    })
  }
}))
