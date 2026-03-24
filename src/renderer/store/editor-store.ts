import { create } from 'zustand'
import { useVaultStore } from './vault-store'

type ViewMode = 'markdown' | 'graph'

function splitLocation(loc: string): [string, string | null] {
  const idx = loc.indexOf('#')
  if (idx === -1) return [loc, null]
  return [loc.slice(0, idx), loc.slice(idx + 1)]
}

function scrollToHash(hash: string | null): void {
  if (!hash) return
  requestAnimationFrame(() => {
    const el = document.getElementById(hash)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

interface EditorState {
  viewMode: ViewMode
  selectedFile: string | null
  scrollHash: string | null
  history: string[]
  historyIndex: number
  canGoBack: boolean
  canGoForward: boolean
  setViewMode: (mode: ViewMode) => void
  selectFile: (location: string) => void
  clear: () => void
  goBack: () => void
  goForward: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  viewMode: 'markdown',
  selectedFile: null,
  scrollHash: null,
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

  selectFile: (location: string) => {
    const { history, historyIndex } = get()
    const [path, hash] = splitLocation(location)
    const currentEntry = historyIndex >= 0 ? history[historyIndex] : null

    if (location === currentEntry) {
      scrollToHash(hash)
      return
    }

    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push(location)
    const newIndex = trimmed.length - 1

    set({
      selectedFile: path,
      scrollHash: hash,
      viewMode: 'markdown',
      history: trimmed,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false
    })

    scrollToHash(hash)

    const vaultPath = useVaultStore.getState().vaultPath
    if (vaultPath) {
      window.axonize.file.addRecent(vaultPath, path).catch(() => {})
    }
  },

  clear: () => set({
    selectedFile: null,
    scrollHash: null,
    viewMode: 'markdown',
    history: [],
    historyIndex: -1,
    canGoBack: false,
    canGoForward: false
  }),

  goBack: () => {
    const { history, historyIndex, selectedFile } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    const [path, hash] = splitLocation(history[newIndex])
    const fileChanged = path !== selectedFile

    set({
      selectedFile: path,
      scrollHash: hash,
      viewMode: 'markdown',
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: true
    })

    if (!fileChanged) scrollToHash(hash)
  },

  goForward: () => {
    const { history, historyIndex, selectedFile } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    const [path, hash] = splitLocation(history[newIndex])
    const fileChanged = path !== selectedFile

    set({
      selectedFile: path,
      scrollHash: hash,
      viewMode: 'markdown',
      historyIndex: newIndex,
      canGoBack: true,
      canGoForward: newIndex < history.length - 1
    })

    if (!fileChanged) scrollToHash(hash)
  }
}))
