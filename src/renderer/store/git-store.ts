import { create } from 'zustand'
import type { GitFileStatus } from '@core/git/types'

interface GitState {
  isRepo: boolean
  gitRoot: string | null
  files: GitFileStatus[]
  commitMessage: string
  isLoading: boolean
  isSuggesting: boolean
  isCommitting: boolean
  error: string | null

  checkIsRepo: (cwd: string) => Promise<void>
  refresh: () => Promise<void>
  stage: (filePath: string) => Promise<void>
  unstage: (filePath: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  commit: () => Promise<void>
  suggestMessage: () => Promise<void>
  setCommitMessage: (msg: string) => void
  clearError: () => void
}

type StoreGet = () => GitState
type StoreSet = (partial: Partial<GitState>) => void

function filesChanged(a: GitFileStatus[], b: GitFileStatus[]): boolean {
  if (a.length !== b.length) return true
  return a.some((f, i) => f.path !== b[i].path || f.status !== b[i].status || f.staged !== b[i].staged)
}

async function gitAction(get: StoreGet, set: StoreSet, fn: (root: string) => Promise<void>): Promise<void> {
  const { gitRoot } = get()
  if (!gitRoot) return
  try {
    await fn(gitRoot)
    await get().refresh()
  } catch (e) {
    set({ error: String(e) })
  }
}

export const useGitStore = create<GitState>((set, get) => ({
  isRepo: false,
  gitRoot: null,
  files: [],
  commitMessage: '',
  isLoading: false,
  isSuggesting: false,
  isCommitting: false,
  error: null,

  checkIsRepo: async (cwd) => {
    try {
      const root = await window.axonize.git.root(cwd)
      if (root) {
        set({ isRepo: true, gitRoot: root })
        await get().refresh()
      } else {
        set({ isRepo: false, gitRoot: null })
      }
    } catch {
      set({ isRepo: false, gitRoot: null })
    }
  },

  refresh: async () => {
    const { gitRoot, files: prev } = get()
    if (!gitRoot) return
    set({ error: null })
    try {
      const files = await window.axonize.git.status(gitRoot)
      if (filesChanged(prev, files)) {
        set({ files, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch (e) {
      set({ isLoading: false, error: String(e) })
    }
  },

  stage: (filePath) => gitAction(get, set, (root) => window.axonize.git.stage(root, filePath)),
  unstage: (filePath) => gitAction(get, set, (root) => window.axonize.git.unstage(root, filePath)),
  stageAll: () => gitAction(get, set, (root) => window.axonize.git.stageAll(root)),
  unstageAll: () => gitAction(get, set, (root) => window.axonize.git.unstageAll(root)),

  commit: async () => {
    const { gitRoot, commitMessage } = get()
    if (!gitRoot || !commitMessage.trim()) return
    set({ isCommitting: true, error: null })
    try {
      await window.axonize.git.commit(gitRoot, commitMessage.trim())
      set({ commitMessage: '', isCommitting: false })
      await get().refresh()
    } catch (e) {
      set({ isCommitting: false, error: String(e) })
    }
  },

  suggestMessage: async () => {
    const { gitRoot } = get()
    if (!gitRoot) return
    set({ isSuggesting: true, error: null })
    try {
      const message = await window.axonize.git.suggestCommitMessage(gitRoot)
      set({ commitMessage: message, isSuggesting: false })
    } catch (e) {
      set({ isSuggesting: false, error: String(e) })
    }
  },

  setCommitMessage: (msg) => set({ commitMessage: msg }),
  clearError: () => set({ error: null })
}))
