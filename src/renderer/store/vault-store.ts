import { create } from 'zustand'
import type { AppSettings } from '../../core/rag/types'

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
  },

  loadExcludedFolders: async () => {
    const s = await window.axonize.settings.get() as AppSettings
    set({ excludedFolders: s.excludedFolders ?? [] })
  },

  excludeFolder: async (relativePath: string) => {
    const s = await window.axonize.settings.get() as AppSettings
    const folders = s.excludedFolders ?? []
    if (folders.includes(relativePath)) return
    const updated = [...folders, relativePath]
    await window.axonize.settings.save({ ...s, excludedFolders: updated })
    set({ excludedFolders: updated })
  },

  includeFolder: async (relativePath: string) => {
    const s = await window.axonize.settings.get() as AppSettings
    const folders = s.excludedFolders ?? []
    const updated = folders.filter((f) => f !== relativePath)
    await window.axonize.settings.save({ ...s, excludedFolders: updated })
    set({ excludedFolders: updated })
  }
}))
