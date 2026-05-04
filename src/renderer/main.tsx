import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useVaultStore, getCurrentVaultFromSession } from './store/vault-store'
import { useEditorStore } from './store/editor-store'
import { useGraphStore } from './store/graph-store'
import { useZoomStore } from './store/zoom-store'
import { useRagStore } from './store/rag-store'
import { useLLMLogStore } from './store/llm-log-store'
import { useAgentStore } from './store/agent-store'
import { useLayoutStore } from './store/layout-store'
import { useSemanticErrorsStore } from './store/semantic-errors-store'
import './styles/global.css'
import './styles/layout.css'
import 'highlight.js/styles/github-dark.min.css'
import 'katex/dist/katex.min.css'

// Expose stores on window for E2E testing
declare global {
  interface Window {
    __stores: {
      vault: typeof useVaultStore
      editor: typeof useEditorStore
      graph: typeof useGraphStore
      zoom: typeof useZoomStore
      rag: typeof useRagStore
      llmLog: typeof useLLMLogStore
      agent: typeof useAgentStore
      layout: typeof useLayoutStore
      semanticErrors: typeof useSemanticErrorsStore
    }
  }
}

window.__stores = {
  vault: useVaultStore,
  editor: useEditorStore,
  graph: useGraphStore,
  zoom: useZoomStore,
  rag: useRagStore,
  llmLog: useLLMLogStore,
  agent: useAgentStore,
  layout: useLayoutStore,
  semanticErrors: useSemanticErrorsStore
}

const axonizeApi = window.axonize

if (axonizeApi) {
// Register index progress listener
axonizeApi.rag.onIndexProgress((payload: unknown) => {
  useRagStore.getState().updateProgress(payload as {
    phase: 'scanning' | 'extracting' | 'embedding' | 'saving' | 'done'
    current: number
    total: number
    file?: string
  })
})

// Register semantic error listeners
axonizeApi.semantic.onError((payload) => {
  const err = payload as { file: string; phase: string; message: string; timestamp: number }
  useSemanticErrorsStore.getState().addError(err)
})

axonizeApi.semantic.onErrorsClear(() => {
  useSemanticErrorsStore.getState().clearErrors()
})

// Register file change listener — refresh tree only (no auto-reindex)
axonizeApi.vault.onFilesChanged(() => {
  const { vaultPath, loadFileTree } = useVaultStore.getState()
  if (!vaultPath) return
  loadFileTree(vaultPath).catch(() => {})
  useRagStore.getState().indexVault(vaultPath)
  // Semantic index is NOT auto-updated to prevent silent token usage
})
}

// Hydrate layout settings on startup
useLayoutStore.getState().hydrateFromSettings()

// Check if a vault was requested via URL hash (from "open in new window")
function getVaultFromHash(): string | null {
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  return params.get('vault') ? decodeURIComponent(params.get('vault')!) : null
}

// Resolve the vault to auto-open on startup.
// Priority:
//   1. sessionStorage — survives webContents.reload() so each window keeps its
//      own vault on cmd+R, even when other windows have opened other vaults
//      (which mutates the shared "recent vaults" list).
//   2. URL hash — set by createWindow(vaultPath) for "open in new window".
//   3. recentVaults[0] — first-launch fallback to most-recently-used vault.
function resolveStartupVault(recentTop: string | null): string | null {
  return getCurrentVaultFromSession() ?? getVaultFromHash() ?? recentTop
}

if (axonizeApi) {
  useVaultStore.getState().loadRecentVaults().then(() => {
    const { recentVaults, openRecentVault } = useVaultStore.getState()
    const recentTop = recentVaults.length > 0 ? recentVaults[0].path : null
    const vaultPath = resolveStartupVault(recentTop)
    if (vaultPath) {
      openRecentVault(vaultPath).then(() => {
        useRagStore.getState().indexVault(vaultPath)
      })
    }
  })
}

const root = document.getElementById('root')!
createRoot(root).render(<App />)
