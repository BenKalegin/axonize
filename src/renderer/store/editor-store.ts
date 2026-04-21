import { create } from 'zustand'
import { useVaultStore } from './vault-store'

export const ViewMode = {
  Markdown: 'markdown',
  Presentation: 'presentation',
  Graph: 'graph',
  Agent: 'agent'
} as const

export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode]

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

function preserveIfPresentation(current: ViewMode): ViewMode {
  return current === ViewMode.Presentation ? ViewMode.Presentation : ViewMode.Markdown
}

function applyHistoryStep(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  newIndex: number
): void {
  const { history, selectedFile, viewMode } = get()
  const [path, hash] = splitLocation(history[newIndex])
  const fileChanged = path !== selectedFile

  set({
    selectedFile: path,
    scrollHash: hash,
    viewMode: preserveIfPresentation(viewMode),
    historyIndex: newIndex,
    canGoBack: newIndex > 0,
    canGoForward: newIndex < history.length - 1
  })

  if (!fileChanged) scrollToHash(hash)
}

interface EditorState {
  viewMode: ViewMode
  selectedFile: string | null
  scrollHash: string | null
  history: string[]
  historyIndex: number
  canGoBack: boolean
  canGoForward: boolean
  presentationIndex: number
  presentationTotal: number
  setViewMode: (mode: ViewMode) => void
  selectFile: (location: string) => void
  clear: () => void
  goBack: () => void
  goForward: () => void
  setPresentationIndex: (i: number) => void
  setPresentationTotal: (n: number) => void
  presentationNext: () => void
  presentationPrev: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  viewMode: ViewMode.Markdown,
  selectedFile: null,
  scrollHash: null,
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,
  presentationIndex: 0,
  presentationTotal: 0,

  setViewMode: (mode: ViewMode) => {
    const prev = get().viewMode
    if (mode === ViewMode.Presentation && prev !== ViewMode.Presentation) {
      set({ viewMode: mode, presentationIndex: 0 })
    } else {
      set({ viewMode: mode })
    }
  },

  selectFile: (location: string) => {
    const { history, historyIndex, viewMode } = get()
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
      viewMode: preserveIfPresentation(viewMode),
      history: trimmed,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: newIndex < trimmed.length - 1
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
    viewMode: ViewMode.Markdown,
    history: [],
    historyIndex: -1,
    canGoBack: false,
    canGoForward: false,
    presentationIndex: 0,
    presentationTotal: 0
  }),

  goBack: () => {
    const { historyIndex } = get()
    if (historyIndex <= 0) return
    applyHistoryStep(get, set, historyIndex - 1)
  },

  goForward: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    applyHistoryStep(get, set, historyIndex + 1)
  },

  setPresentationIndex: (i) =>
    set({ presentationIndex: i }),

  setPresentationTotal: (n) =>
    set({ presentationTotal: n }),

  presentationNext: () => {
    const { presentationIndex, presentationTotal } = get()
    if (presentationIndex < presentationTotal - 1) {
      set({ presentationIndex: presentationIndex + 1 })
    }
  },

  presentationPrev: () => {
    const { presentationIndex } = get()
    if (presentationIndex > 0) {
      set({ presentationIndex: presentationIndex - 1 })
    }
  }
}))
