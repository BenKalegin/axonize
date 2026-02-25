import { create } from 'zustand'

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
  openVault: () => Promise<void>
  setVaultPath: (path: string) => void
  loadFileTree: (path: string) => Promise<void>
  loadRecentVaults: () => Promise<void>
  removeRecentVault: (path: string) => Promise<void>
  openRecentVault: (path: string) => Promise<void>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  vaultName: null,
  fileTree: [],
  recentVaults: [],

  openVault: async () => {
    const path = await window.axonize.vault.open()
    if (path) {
      const name = vaultNameFromPath(path)
      set({ vaultPath: path, vaultName: name })
      const files = await window.axonize.vault.readFiles(path) as FileEntry[]
      set({ fileTree: files })
      await get().loadRecentVaults()
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
  }
}))
