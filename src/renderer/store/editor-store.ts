import { create } from 'zustand'

type ViewMode = 'markdown' | 'graph'

interface EditorState {
  viewMode: ViewMode
  selectedFile: string | null
  setViewMode: (mode: ViewMode) => void
  selectFile: (path: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  viewMode: 'markdown',
  selectedFile: null,

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  selectFile: (path: string) => set({ selectedFile: path, viewMode: 'markdown' })
}))
