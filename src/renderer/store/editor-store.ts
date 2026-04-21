import { create } from 'zustand'
import { useVaultStore } from './vault-store'

export const ViewMode = {
  Markdown: 'markdown',
  Presentation: 'presentation',
  Graph: 'graph'
} as const

export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode]

export const SelectionKind = {
  File: 'file',
  AgentTurn: 'agent-turn'
} as const

export type SelectionKind = (typeof SelectionKind)[keyof typeof SelectionKind]

export type FileSelection = {
  kind: typeof SelectionKind.File
  path: string
  hash: string | null
}

export type AgentTurnSelection = {
  kind: typeof SelectionKind.AgentTurn
  sessionId: string
  turnId: string
  filePath: string
}

export type Selection = FileSelection | AgentTurnSelection

export function selectedFilePath(selection: Selection | null): string | null {
  if (!selection) return null
  return selection.kind === SelectionKind.File ? selection.path : selection.filePath
}

export function isFileSelection(selection: Selection | null): selection is FileSelection {
  return selection !== null && selection.kind === SelectionKind.File
}

export function isAgentTurnSelection(selection: Selection | null): selection is AgentTurnSelection {
  return selection !== null && selection.kind === SelectionKind.AgentTurn
}

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

function makeFileSelection(location: string): FileSelection {
  const [path, hash] = splitLocation(location)
  return { kind: SelectionKind.File, path, hash }
}

function selectionsEqual(a: Selection | null, b: Selection | null): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  switch (a.kind) {
    case SelectionKind.File:
      return a.path === (b as FileSelection).path && a.hash === (b as FileSelection).hash
    case SelectionKind.AgentTurn:
      return a.turnId === (b as AgentTurnSelection).turnId
  }
}

interface EditorState {
  viewMode: ViewMode
  selection: Selection | null
  history: Selection[]
  historyIndex: number
  canGoBack: boolean
  canGoForward: boolean
  presentationIndex: number
  presentationTotal: number
  setViewMode: (mode: ViewMode) => void
  selectFile: (location: string) => void
  selectAgentTurn: (ref: { sessionId: string; turnId: string; filePath: string }) => void
  clear: () => void
  goBack: () => void
  goForward: () => void
  setPresentationIndex: (i: number) => void
  setPresentationTotal: (n: number) => void
  presentationNext: () => void
  presentationPrev: () => void
}

function applyHistoryStep(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  newIndex: number
): void {
  const { history, selection, viewMode } = get()
  const next = history[newIndex]
  const wasFile = isFileSelection(selection)
  const nextIsSameFile = isFileSelection(next) && wasFile && next.path === selection.path

  set({
    selection: next,
    viewMode: preserveIfPresentation(viewMode),
    historyIndex: newIndex,
    canGoBack: newIndex > 0,
    canGoForward: newIndex < history.length - 1
  })

  if (nextIsSameFile && isFileSelection(next)) scrollToHash(next.hash)
}

export const useEditorStore = create<EditorState>((set, get) => ({
  viewMode: ViewMode.Markdown,
  selection: null,
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
    const next = makeFileSelection(location)
    const { history, historyIndex, selection, viewMode } = get()

    if (selectionsEqual(next, selection)) {
      scrollToHash(next.hash)
      return
    }

    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push(next)
    const newIndex = trimmed.length - 1

    set({
      selection: next,
      viewMode: preserveIfPresentation(viewMode),
      history: trimmed,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false
    })

    scrollToHash(next.hash)

    const vaultPath = useVaultStore.getState().vaultPath
    if (vaultPath) {
      window.axonize.file.addRecent(vaultPath, next.path).catch(() => {})
    }
  },

  selectAgentTurn: (ref) => {
    const next: AgentTurnSelection = {
      kind: SelectionKind.AgentTurn,
      sessionId: ref.sessionId,
      turnId: ref.turnId,
      filePath: ref.filePath
    }
    const { history, historyIndex, selection } = get()

    if (selectionsEqual(next, selection)) return

    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push(next)
    const newIndex = trimmed.length - 1

    set({
      selection: next,
      history: trimmed,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false
    })
  },

  clear: () => set({
    selection: null,
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
