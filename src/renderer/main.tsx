import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useVaultStore } from './store/vault-store'
import { useEditorStore } from './store/editor-store'
import { useGraphStore } from './store/graph-store'
import { useZoomStore } from './store/zoom-store'
import { useRagStore } from './store/rag-store'
import { useLLMLogStore } from './store/llm-log-store'
import { useLayoutStore } from './store/layout-store'
import { useSemanticErrorsStore } from './store/semantic-errors-store'
import './styles/global.css'
import './styles/layout.css'

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
  layout: useLayoutStore,
  semanticErrors: useSemanticErrorsStore
}

// Register index progress listener
window.axonize.rag.onIndexProgress((payload: unknown) => {
  useRagStore.getState().updateProgress(payload as {
    phase: 'scanning' | 'extracting' | 'embedding' | 'saving' | 'done'
    current: number
    total: number
    file?: string
  })
})

// Register semantic error listeners
window.axonize.semantic.onError((payload) => {
  const err = payload as { file: string; phase: string; message: string; timestamp: number }
  useSemanticErrorsStore.getState().addError(err)
})

window.axonize.semantic.onErrorsClear(() => {
  useSemanticErrorsStore.getState().clearErrors()
})

// Register file change listener — refresh tree + incremental reindex
window.axonize.vault.onFilesChanged(() => {
  const { vaultPath, loadFileTree } = useVaultStore.getState()
  if (!vaultPath) return
  loadFileTree(vaultPath).catch(() => {})
  useRagStore.getState().indexVault(vaultPath)
  window.axonize.semantic.incremental(vaultPath).catch(() => {})
})

// Hydrate layout settings on startup
useLayoutStore.getState().hydrateFromSettings()

// Load recent vaults on startup, auto-open the most recent one
useVaultStore.getState().loadRecentVaults().then(() => {
  const { recentVaults, openRecentVault } = useVaultStore.getState()
  if (recentVaults.length > 0) {
    openRecentVault(recentVaults[0].path).then(() => {
      // Fire-and-forget: index vault after opening
      const { vaultPath } = useVaultStore.getState()
      if (vaultPath) {
        useRagStore.getState().indexVault(vaultPath)
      }
    })
  }
})

const root = document.getElementById('root')!
createRoot(root).render(<App />)
