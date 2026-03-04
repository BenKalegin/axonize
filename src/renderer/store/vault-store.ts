import { create } from 'zustand'
import type { AppSettings } from '@core/rag/types'
import { useGeneratedDocsStore } from './generated-docs-store'
import { useRagStore } from './rag-store'
import { useGraphStore } from './graph-store'

async function loadSemanticCache(vaultPath: string): Promise<void> {
  const { cards, relations, dimensions } = await window.axonize.semantic.load(vaultPath)
  if (cards.length > 0) {
    useGraphStore.getState().loadSemanticData(cards, relations, dimensions ?? [])
  }
}

async function runSemanticIndex(vaultPath: string): Promise<void> {
  useGraphStore.getState().clear()

  // Load cached data first so graph is usable immediately
  try {
    await loadSemanticCache(vaultPath)
  } catch {
    console.warn('[semantic] No cached semantic data yet')
  }

  // Then run incremental decomposition in background
  try {
    console.log('[semantic] Starting incremental decomposition for', vaultPath)
    await window.axonize.semantic.incremental(vaultPath)
    console.log('[semantic] Decomposition complete, loading results')
    await loadSemanticCache(vaultPath)
  } catch (err) {
    console.error('[semantic] Decomposition failed:', err)
  }
}

const DOC_SLUGS = new Set(['doc', 'docs'])

function vaultNameFromPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  const last = parts.at(-1) || p
  if (DOC_SLUGS.has(last.toLowerCase()) && parts.length >= 2) {
    return parts.at(-2)!
  }
  return last
}

interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileEntry[]
}

interface RecentVault {
  path: string
  name: string
  openedAt: number
}

interface VaultState {
  vaultPath: string | null
  vaultName: string | null
  fileTree: FileEntry[]
  recentVaults: RecentVault[]
  excludedFolders: string[]
  openVault: () => Promise<void>
  setVaultPath: (path: string) => void
  loadFileTree: (path: string) => Promise<void>
  loadRecentVaults: () => Promise<void>
  removeRecentVault: (path: string) => Promise<void>
  openRecentVault: (path: string) => Promise<void>
  loadExcludedFolders: () => Promise<void>
  excludeFolder: (relativePath: string) => Promise<void>
  includeFolder: (relativePath: string) => Promise<void>
  refreshVault: () => Promise<void>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  vaultName: null,
  fileTree: [],
  recentVaults: [],
  excludedFolders: [],

  openVault: async () => {
    const path = await window.axonize.vault.open()
    if (path) {
      const name = vaultNameFromPath(path)
      set({ vaultPath: path, vaultName: name })
      const files = await window.axonize.vault.readFiles(path) as FileEntry[]
      set({ fileTree: files })
      await get().loadRecentVaults()
      await get().loadExcludedFolders()
      useGeneratedDocsStore.getState().runCleanup(path).catch(() => {})
      runSemanticIndex(path).catch(() => {})
      window.axonize.vault.startWatch(path).catch(() => {})
    }
  },

  setVaultPath: (path: string) => {
    const name = vaultNameFromPath(path)
    set({ vaultPath: path, vaultName: name })
  },

  loadFileTree: async (path: string) => {
    const files = await window.axonize.vault.readFiles(path) as FileEntry[]
    set({ fileTree: files })
  },

  loadRecentVaults: async () => {
    const vaults = await window.axonize.vault.getRecent()
    set({ recentVaults: vaults })
  },

  removeRecentVault: async (path: string) => {
    await window.axonize.vault.removeRecent(path)
    await get().loadRecentVaults()
  },

  openRecentVault: async (path: string) => {
    const name = vaultNameFromPath(path)
    set({ vaultPath: path, vaultName: name })
    const files = await window.axonize.vault.readFiles(path) as FileEntry[]
    set({ fileTree: files })
    await window.axonize.vault.addRecent(path, name)
    await get().loadRecentVaults()
    await get().loadExcludedFolders()
    useGeneratedDocsStore.getState().runCleanup(path).catch(() => {})
    runSemanticIndex(path).catch(() => {})
    window.axonize.vault.startWatch(path).catch(() => {})
  },

  loadExcludedFolders: async () => {
    const s = await window.axonize.settings.get() as AppSettings
    set({ excludedFolders: s.excludedFolders ?? [] })
  },

  excludeFolder: async (relativePath: string) => {
    const { vaultPath } = get()
    const s = await window.axonize.settings.get() as AppSettings
    const folders = s.excludedFolders ?? []
    if (folders.includes(relativePath)) return
    const updated = [...folders, relativePath]
    await window.axonize.settings.save({ ...s, excludedFolders: updated })
    set({ excludedFolders: updated })
    if (vaultPath) {
      window.axonize.rag.purgeFolder(vaultPath, relativePath).then((_result) => {
        useRagStore.getState().updateStatus()
      }).catch(() => {})
    }
  },

  includeFolder: async (relativePath: string) => {
    const s = await window.axonize.settings.get() as AppSettings
    const folders = s.excludedFolders ?? []
    const updated = folders.filter((f) => f !== relativePath)
    await window.axonize.settings.save({ ...s, excludedFolders: updated })
    set({ excludedFolders: updated })
  },

  refreshVault: async () => {
    const { vaultPath } = get()
    if (!vaultPath) return
    const files = await window.axonize.vault.readFiles(vaultPath) as FileEntry[]
    set({ fileTree: files })
    await get().loadExcludedFolders()
    runSemanticIndex(vaultPath).catch(() => {})
  }
}))
