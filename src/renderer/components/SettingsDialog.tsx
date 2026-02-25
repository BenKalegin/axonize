import { useState, useEffect, useCallback } from 'react'
import { TEST_IDS } from '../lib/testids'
import { useRagStore } from '../store/rag-store'
import { useVaultStore } from '../store/vault-store'
import { useEditorStore } from '../store/editor-store'
import type { AppSettings } from '../../core/rag/types'
import { DEFAULT_SETTINGS } from '../../core/rag/types'

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  const { isIndexing, indexProgress, fullReindex, reindexFile, chunkCount } = useRagStore()
  const { vaultPath } = useVaultStore()
  const { selectedFile } = useEditorStore()

  useEffect(() => {
    window.axonize.settings.get().then((s) => {
      setSettings(s as AppSettings)
      setLoaded(true)
    })
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSave = async () => {
    await window.axonize.settings.save(settings)
    onClose()
  }

  const handleReindex = () => {
    if (vaultPath && !isIndexing) {
      fullReindex(vaultPath)
    }
  }

  const handleReindexFile = () => {
    if (vaultPath && selectedFile && !isIndexing) {
      const relativePath = selectedFile.startsWith(vaultPath)
        ? selectedFile.slice(vaultPath.length + 1)
        : selectedFile
      reindexFile(vaultPath, relativePath)
    }
  }

  const statusText = isIndexing && indexProgress
    ? `${indexProgress.phase}: ${indexProgress.current}/${indexProgress.total}`
    : `${chunkCount} chunks`

  const updateLLM = <K extends keyof AppSettings['llm']>(key: K, value: AppSettings['llm'][K]) => {
    setSettings(prev => ({ ...prev, llm: { ...prev.llm, [key]: value } }))
  }

  const updateRag = <K extends keyof AppSettings['rag']>(key: K, value: AppSettings['rag'][K]) => {
    setSettings(prev => ({ ...prev, rag: { ...prev.rag, [key]: value } }))
  }

  if (!loaded) return null

  return (
    <div
      data-testid={TEST_IDS.SETTINGS_DIALOG}
      className="settings-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="settings-dialog">
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-body">
          {/* LLM Configuration */}
          <div className="settings-section">
            <div className="settings-section-title">LLM Configuration</div>

            <div className="settings-field">
              <label>Provider</label>
              <select
                className="settings-select"
                value={settings.llm.provider}
                onChange={e => updateLLM('provider', e.target.value as AppSettings['llm']['provider'])}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>

            {settings.llm.provider !== 'ollama' && (
              <div className="settings-field">
                <label>API Key</label>
                <input
                  className="settings-input"
                  type="password"
                  value={settings.llm.apiKey ?? ''}
                  onChange={e => updateLLM('apiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            )}

            <div className="settings-field">
              <label>Model</label>
              <input
                className="settings-input"
                type="text"
                value={settings.llm.model}
                onChange={e => updateLLM('model', e.target.value)}
              />
            </div>

            <div className="settings-row">
              <div className="settings-field">
                <label>Max Tokens</label>
                <input
                  className="settings-input"
                  type="number"
                  value={settings.llm.maxTokens}
                  onChange={e => updateLLM('maxTokens', Number(e.target.value))}
                  min={1}
                />
              </div>
              <div className="settings-field">
                <label>Temperature</label>
                <input
                  className="settings-input"
                  type="number"
                  value={settings.llm.temperature}
                  onChange={e => updateLLM('temperature', Number(e.target.value))}
                  min={0}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>

            {settings.llm.provider === 'ollama' && (
              <div className="settings-field">
                <label>Base URL</label>
                <input
                  className="settings-input"
                  type="text"
                  value={settings.llm.baseUrl ?? ''}
                  onChange={e => updateLLM('baseUrl', e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
            )}
          </div>

          {/* Retrieval */}
          <div className="settings-section">
            <div className="settings-section-title">Retrieval</div>
            <div className="settings-row">
              <div className="settings-field">
                <label>Top K</label>
                <input
                  className="settings-input"
                  type="number"
                  value={settings.rag.topK}
                  onChange={e => updateRag('topK', Number(e.target.value))}
                  min={1}
                />
              </div>
              <div className="settings-field">
                <label>Min Score</label>
                <input
                  className="settings-input"
                  type="number"
                  value={settings.rag.minScore}
                  onChange={e => updateRag('minScore', Number(e.target.value))}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>
          </div>

          {/* Indexing */}
          <div className="settings-section">
            <div className="settings-section-title">Indexing</div>
            <div className="settings-reindex-row">
              <button
                data-testid={TEST_IDS.REINDEX_FILE_BTN}
                className="toolbar-btn"
                onClick={handleReindexFile}
                disabled={isIndexing || !selectedFile || !vaultPath}
              >
                Re-idx File
              </button>
              <button
                data-testid={TEST_IDS.REINDEX_VAULT_BTN}
                className="toolbar-btn"
                onClick={handleReindex}
                disabled={isIndexing || !vaultPath}
              >
                Full Reindex
              </button>
              <span data-testid={TEST_IDS.INDEX_STATUS} className="index-status">
                {statusText}
              </span>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button
            data-testid={TEST_IDS.SETTINGS_CANCEL_BTN}
            className="toolbar-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            data-testid={TEST_IDS.SETTINGS_SAVE_BTN}
            className="toolbar-btn active"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
