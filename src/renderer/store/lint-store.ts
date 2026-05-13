import { useEffect } from 'react'
import { create } from 'zustand'
import { lintMarkdown } from '@core/markdown/lint/linter'
import type { LintIssue } from '@core/markdown/lint/types'
import { useVaultStore, type FileEntry } from './vault-store'
import { useEditorStore, selectedFilePath } from './editor-store'

const DEBOUNCE_MS = 400

function flattenVaultFiles(entries: FileEntry[]): Set<string> {
  const paths = new Set<string>()
  function walk(items: FileEntry[]): void {
    for (const item of items) {
      if (!item.isDirectory) paths.add(item.relativePath)
      if (item.children) walk(item.children)
    }
  }
  walk(entries)
  return paths
}

interface LintState {
  issues: Record<string, LintIssue[]>
  running: boolean
  lintFile: (filePath: string) => Promise<void>
  clearFile: (filePath: string) => void
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const useLintStore = create<LintState>((set, get) => ({
  issues: {},
  running: false,

  lintFile: async (filePath: string) => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    if (!get().running) set({ running: true })

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      const { vaultPath, fileTree } = useVaultStore.getState()
      if (!vaultPath) {
        set({ running: false })
        return
      }
      try {
        const content = await window.axonize.file.read(filePath)
        const vaultFiles = flattenVaultFiles(fileTree as FileEntry[])

        const result = lintMarkdown({
          filePath,
          vaultPath,
          content,
          vaultFiles,
          getFileContent: () => undefined
        })

        set((s) => ({ issues: { ...s.issues, [filePath]: result }, running: false }))
      } catch {
        set({ running: false })
      }
    }, DEBOUNCE_MS)
  },

  clearFile: (filePath: string) => {
    set((s) => {
      const next = { ...s.issues }
      delete next[filePath]
      return { issues: next }
    })
  }
}))

export function useLintBootstrap(): void {
  useEffect(() => {
    let currentFilePath: string | null = null

    const unsubEditor = useEditorStore.subscribe((state) => {
      const filePath = selectedFilePath(state.selection)
      if (filePath && filePath !== currentFilePath) {
        currentFilePath = filePath
        useLintStore.getState().lintFile(filePath)
      }
    })

    const unsubVault = window.axonize.vault.onFilesChanged(() => {
      const filePath = selectedFilePath(useEditorStore.getState().selection)
      if (filePath) useLintStore.getState().lintFile(filePath)
    })

    return () => {
      unsubEditor()
      unsubVault()
    }
  }, [])
}
