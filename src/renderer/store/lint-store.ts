import { useEffect } from 'react'
import { create } from 'zustand'
import { lintMarkdown } from '@core/markdown/lint/linter'
import type { LintIssue } from '@core/markdown/lint/types'
import { collectLinkedMarkdownTargets } from '@core/markdown/link-targets'
import { relativePathFromVault } from '@core/markdown/lint/utils'
import { useVaultStore } from './vault-store'
import { useEditorStore, selectedFilePath } from './editor-store'

const DEBOUNCE_MS = 400

let allFilesCache: { vaultPath: string; files: Set<string> } | null = null

async function loadAllVaultFiles(vaultPath: string): Promise<Set<string>> {
  if (allFilesCache && allFilesCache.vaultPath === vaultPath) return allFilesCache.files
  const list = await window.axonize.vault.listAllFiles(vaultPath)
  const files = new Set(list)
  allFilesCache = { vaultPath, files }
  return files
}

function invalidateAllFilesCache(): void {
  allFilesCache = null
}

// cyrb53 — fast non-crypto 64-bit string hash; collision rate is negligible
// for our use (skipping redundant lint runs on identical content).
function hashContent(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

async function prefetchTargets(
  targets: Set<string>,
  vaultPath: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  await Promise.all(
    [...targets].map(async (rel) => {
      try {
        map.set(rel, await window.axonize.file.read(vaultPath + '/' + rel))
      } catch {
        // ignore — broken-links rule reports missing files separately
      }
    })
  )
  return map
}

interface LintState {
  issues: Record<string, LintIssue[]>
  running: boolean
  lintFile: (filePath: string) => Promise<void>
  clearFile: (filePath: string) => void
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const lastHashes = new Map<string, string>()

export const useLintStore = create<LintState>((set, get) => ({
  issues: {},
  running: false,

  lintFile: async (filePath: string) => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    if (!get().running) set({ running: true })

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      const { vaultPath } = useVaultStore.getState()
      if (!vaultPath) {
        set({ running: false })
        return
      }
      try {
        const content = await window.axonize.file.read(filePath)
        const hash = hashContent(content)
        if (lastHashes.get(filePath) === hash) {
          set({ running: false })
          return
        }

        const vaultFiles = await loadAllVaultFiles(vaultPath)
        const currentRelPath = relativePathFromVault(filePath, vaultPath)
        const targets = collectLinkedMarkdownTargets(content, currentRelPath, vaultFiles)
        const fileContents = await prefetchTargets(targets, vaultPath)

        const result = lintMarkdown({
          filePath,
          vaultPath,
          content,
          vaultFiles,
          getFileContent: (rel) => fileContents.get(rel)
        })

        lastHashes.set(filePath, hash)
        set((s) => ({ issues: { ...s.issues, [filePath]: result }, running: false }))
      } catch {
        set({ running: false })
      }
    }, DEBOUNCE_MS)
  },

  clearFile: (filePath: string) => {
    lastHashes.delete(filePath)
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
      invalidateAllFilesCache()
      const filePath = selectedFilePath(useEditorStore.getState().selection)
      if (filePath) useLintStore.getState().lintFile(filePath)
    })

    return () => {
      unsubEditor()
      unsubVault()
    }
  }, [])
}
