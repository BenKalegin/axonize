import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useVaultStore } from './store/vault-store'
import { useEditorStore } from './store/editor-store'
import { useGraphStore } from './store/graph-store'
import { useZoomStore } from './store/zoom-store'
import { useRagStore } from './store/rag-store'
import { useLayoutStore } from './store/layout-store'
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
      layout: typeof useLayoutStore
    }
  }
}

window.__stores = {
  vault: useVaultStore,
  editor: useEditorStore,
  graph: useGraphStore,
  zoom: useZoomStore,
  rag: useRagStore,
  layout: useLayoutStore
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
