import { useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useVaultStore } from '@/store/vault-store'
import { useEditorStore, ViewMode } from '@/store/editor-store'
import { VaultMenu } from './VaultMenu'

const BackIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M8 1L3 6L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ForwardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M4 1L9 6L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

interface TopTab {
  id: ViewMode
  label: string
  testId: string
}

const TOP_TABS: TopTab[] = [
  { id: ViewMode.Markdown, label: 'Markdown', testId: TEST_IDS.VIEW_MARKDOWN_BTN },
  { id: ViewMode.Presentation, label: 'Presentation', testId: TEST_IDS.VIEW_PRESENTATION_BTN },
  { id: ViewMode.Graph, label: 'Graph', testId: TEST_IDS.VIEW_GRAPH_BTN }
]
import { useRagStore } from '@/store/rag-store'
import { SettingsDialog } from './SettingsDialog'
import { JobStatusIndicator } from './JobStatusIndicator'

export function Toolbar() {
  const { vaultPath, refreshVault } = useVaultStore()
  const { viewMode, setViewMode, canGoBack, canGoForward, goBack, goForward, backTarget, forwardTarget, diffPreviewFile, clearDiffPreviewFile } = useEditorStore()
  const { chunkCount } = useRagStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const diffPreviewFileName = diffPreviewFile?.path.split('/').pop()

  return (
    <div className="toolbar-content">
      <div className="toolbar-left">
        <VaultMenu />
        {vaultPath && (
          <>
            <button
              data-testid={TEST_IDS.REFRESH_VAULT_BTN}
              className="toolbar-btn toolbar-refresh-btn"
              onClick={refreshVault}
              title="Refresh vault"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12 2v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.5 9A5 5 0 1 1 11.1 4.5L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="toolbar-btn nav-btn"
              onClick={goBack}
              disabled={!canGoBack}
              data-tooltip={backTarget ? `Back to ${backTarget}` : 'Go back'}
            >
              <BackIcon />
            </button>
            <button
              className="toolbar-btn nav-btn"
              onClick={goForward}
              disabled={!canGoForward}
              data-tooltip={forwardTarget ? `Forward to ${forwardTarget}` : 'Go forward'}
            >
              <ForwardIcon />
            </button>
          </>
        )}
      </div>
      <div className="toolbar-center">
        {diffPreviewFile ? (
          <>
            <span className="diff-preview-label">
              Changes: {diffPreviewFileName}
            </span>
            <button
              className="toolbar-btn"
              data-testid={TEST_IDS.DIFF_PREVIEW_BACK_BTN}
              onClick={clearDiffPreviewFile}
            >
              Back
            </button>
          </>
        ) : (
          TOP_TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={tab.testId}
              className={`toolbar-btn ${viewMode === tab.id ? 'active' : ''}`}
              onClick={() => setViewMode(tab.id)}
            >
              {tab.label}
            </button>
          ))
        )}
      </div>
      <div className="toolbar-right">
        <JobStatusIndicator />
        {vaultPath && (
          <span className="index-status">{chunkCount} chunks</span>
        )}
        <button
          data-testid={TEST_IDS.SETTINGS_BTN}
          className="toolbar-btn settings-gear-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 1L6.09 2.84a5.5 5.5 0 0 0-1.27.73L3 3.04l-1.5 2.6 1.52 1.58a5.5 5.5 0 0 0 0 1.56L1.5 10.36l1.5 2.6 1.82-.53c.38.3.8.54 1.27.73L6.5 15h3l.41-1.84a5.5 5.5 0 0 0 1.27-.73l1.82.53 1.5-2.6-1.52-1.58a5.5 5.5 0 0 0 0-1.56l1.52-1.58-1.5-2.6-1.82.53a5.5 5.5 0 0 0-1.27-.73L9.5 1h-3zM8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
