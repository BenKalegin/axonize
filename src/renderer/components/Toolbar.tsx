import { useState, useEffect, useRef } from 'react'
import { TEST_IDS } from '../lib/testids'
import { useVaultStore } from '../store/vault-store'
import { useEditorStore } from '../store/editor-store'
import { useRagStore } from '../store/rag-store'
import { SettingsDialog } from './SettingsDialog'

export function Toolbar() {
  const { vaultPath, vaultName, openVault, recentVaults, openRecentVault, loadRecentVaults } = useVaultStore()
  const { viewMode, setViewMode, canGoBack, canGoForward, goBack, goForward } = useEditorStore()
  const { chunkCount } = useRagStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const toggleDropdown = async () => {
    if (!dropdownOpen) {
      await loadRecentVaults()
      setDropdownOpen(true)
    } else {
      setDropdownOpen(false)
    }
  }

  return (
    <div className="toolbar-content">
      <div className="toolbar-left">
        <div className="vault-btn-group" ref={groupRef}>
          <button
            data-testid={TEST_IDS.OPEN_VAULT_BTN}
            className="toolbar-btn"
            onClick={openVault}
          >
            Open Vault
          </button>
          <button
            className="vault-chevron"
            onClick={toggleDropdown}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {dropdownOpen && (
            <div data-testid={TEST_IDS.VAULT_DROPDOWN} className="vault-dropdown">
              {recentVaults.length > 0 ? (
                recentVaults.map(vault => (
                  <div
                    key={vault.path}
                    data-testid={TEST_IDS.VAULT_DROPDOWN_ITEM}
                    className="vault-dropdown-item"
                    onClick={() => {
                      openRecentVault(vault.path)
                      setDropdownOpen(false)
                    }}
                  >
                    <span className="vault-dropdown-item-name">{vault.name}</span>
                    <span className="vault-dropdown-item-path">{vault.path}</span>
                  </div>
                ))
              ) : (
                <div className="vault-dropdown-empty">No recent vaults</div>
              )}
            </div>
          )}
        </div>
        {vaultPath && (
          <span data-testid={TEST_IDS.VAULT_NAME} className="vault-name">
            {vaultName}
          </span>
        )}
        {vaultPath && (
          <div className="nav-buttons">
            <button
              className="toolbar-btn nav-btn"
              onClick={goBack}
              disabled={!canGoBack}
              title="Go back"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 1L3 6L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="toolbar-btn nav-btn"
              onClick={goForward}
              disabled={!canGoForward}
              title="Go forward"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 1L9 6L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="toolbar-center">
        <button
          data-testid={TEST_IDS.VIEW_MARKDOWN_BTN}
          className={`toolbar-btn ${viewMode === 'markdown' ? 'active' : ''}`}
          onClick={() => setViewMode('markdown')}
        >
          Markdown
        </button>
        <button
          data-testid={TEST_IDS.VIEW_GRAPH_BTN}
          className={`toolbar-btn ${viewMode === 'graph' ? 'active' : ''}`}
          onClick={() => setViewMode('graph')}
        >
          Graph
        </button>
      </div>
      <div className="toolbar-right">
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
