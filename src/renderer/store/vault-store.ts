import { create } from 'zustand'
import type { AppSettings } from '@core/rag/types'
import type { FileEntry } from '@core/vault/types'
import { vaultNameFromPath } from '@core/vault/name'
import { useGeneratedDocsStore } from './generated-docs-store'
import { useRagStore } from './rag-store'
import { useGraphStore } from './graph-store'
import { useEditorStore } from './editor-store'

// Per-window vault persistence. sessionStorage is per-renderer-process in Electron,
// so it survives webContents.reload() (cmd+R) but not full app restart — exactly
// what we want so each window keeps its own vault on reload.
const CURRENT_VAULT_SESSION_KEY = 'axonize.currentVault'

export function getCurrentVaultFromSession(): string | null {
  try {
    return sessionStorage.getItem(CURRENT_VAULT_SESSION_KEY)
  } catch {
    return null
  }
}

function setCurrentVaultInSession(path: string): void {
  try {
    sessionStorage.setItem(CURRENT_VAULT_SESSION_KEY, path)
  } catch {
    /* sessionStorage unavailable */
  }
}

async function loadSemanticCache(vaultPath: string): Promise<void> {
  const { cards, relations, dimensions } = await window.axonize.semantic.load(vaultPath)
  if (cards.length > 0) {
    useGraphStore.getState().loadSemanticData(cards, relations, dimensions ?? [])
  }
}

async function loadSemanticCacheOnly(vaultPath: string): Promise<void> {
  useGraphStore.getState().clear()

  // Load cached data only (no auto-indexing)
  try {
    await loadSemanticCache(vaultPath)
  } catch {
    console.warn('[semantic] No cached semantic data yet')
  }
}

async function restoreLastFile(vaultPath: string): Promise<void> {
  try {
    const recentFiles = await window.axonize.file.getRecent(vaultPath)
    if (recentFiles.length > 0) {
      useEditorStore.getState().selectFile(recentFiles[0].path)
    }
  } catch { /* no recent files */ }
}

export type { FileEntry }

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
  createNewVault: () => Promise<string | null>
  setVaultPath: (path: string) => void
  loadFileTree: (path: string) => Promise<void>
  loadRecentVaults: () => Promise<void>
  removeRecentVault: (path: string) => Promise<void>
  openRecentVault: (path: string) => Promise<void>
  loadExcludedFolders: () => Promise<void>
  excludeFolder: (relativePath: string) => Promise<void>
  includeFolder: (relativePath: string) => Promise<void>
  refreshVault: () => Promise<void>
  openVaultInNewWindow: (path: string) => Promise<void>
}

// Shared activation flow for any code path that switches this window to a vault
// (initial open, picking a recent vault, creating a brand-new vault). The
// addRecent flag is true when the path may not yet be in the recents list —
// vault:open already records the new path on the main side, but openRecentVault
// and createNewVault need an explicit save to bump openedAt.
async function activateVaultInWindow(
  path: string,
  set: (partial: Partial<VaultState>) => void,
  get: () => VaultState,
  options: { addRecent: boolean }
): Promise<void> {
  useEditorStore.getState().clear()
  const name = vaultNameFromPath(path)
  setCurrentVaultInSession(path)
  set({ vaultPath: path, vaultName: name })
  window.axonize.window.setTitle(name).catch(() => {})
  window.axonize.window.setVault(path).catch(() => {})
  const files = await window.axonize.vault.readFiles(path) as FileEntry[]
  set({ fileTree: files })
  if (options.addRecent) {
    await window.axonize.vault.addRecent(path, name)
  }
  await get().loadRecentVaults()
  await get().loadExcludedFolders()
  restoreLastFile(path).catch(() => {})
  useGeneratedDocsStore.getState().runCleanup(path).catch(() => {})
  window.axonize.agentHistory.cleanup(path).catch(() => {})
  loadSemanticCacheOnly(path).catch(() => {})
  window.axonize.vault.startWatch(path).catch(() => {})
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
      await activateVaultInWindow(path, set, get, { addRecent: false })
    }
  },

  createNewVault: async () => {
    const path = await window.axonize.vault.createNew()
    if (!path) return null
    await activateVaultInWindow(path, set, get, { addRecent: false })
    return path
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
    await activateVaultInWindow(path, set, get, { addRecent: true })
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
    loadSemanticCacheOnly(vaultPath).catch(() => {})
  },

  openVaultInNewWindow: async (path: string) => {
    await window.axonize.window.openNew(path)
  }
}))
