import { useState, useEffect, useCallback, useRef } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useRagStore } from '@/store/rag-store'
import { useVaultStore } from '@/store/vault-store'
import { useEditorStore } from '@/store/editor-store'
import type { AppSettings } from '@core/rag/types'
import { DEFAULT_SETTINGS } from '@core/rag/types'
import { PROVIDER_MODELS, DEFAULT_MODELS } from '@/lib/llm-models'
import { THEMES, ThemeGroup, type ThemeId } from '@core/themes'
import { applyTheme } from '@/lib/theme-applier'

const SettingsTab = {
  General: 'general',
  Appearance: 'appearance',
} as const
type SettingsTab = (typeof SettingsTab)[keyof typeof SettingsTab]

const PREVIEW_BAR_COUNT = 4

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>(SettingsTab.General)
  const originalThemeRef = useRef<string>('')

  const { isIndexing, indexProgress, fullReindex, reindexFile, chunkCount } = useRagStore()
  const { vaultPath } = useVaultStore()
  const { selectedFile } = useEditorStore()

  useEffect(() => {
    window.axonize.settings.get().then((s) => {
      const loaded = s as AppSettings
      setSettings(loaded)
      originalThemeRef.current = loaded.appearance?.themeId ?? DEFAULT_SETTINGS.appearance!.themeId
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

  const { loadExcludedFolders } = useVaultStore()

  const handleSave = async () => {
    await window.axonize.settings.save(settings)
    await loadExcludedFolders()
    onClose()
  }

  const handleCancel = () => {
    // Revert theme to what was saved before opening
    applyTheme(originalThemeRef.current as ThemeId)
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

  const updateAgent = <K extends keyof AppSettings['agent']>(key: K, value: AppSettings['agent'][K]) => {
    setSettings(prev => ({ ...prev, agent: { ...prev.agent, [key]: value } }))
  }

  const handleThemeSelect = (themeId: ThemeId) => {
    applyTheme(themeId)
    setSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, themeId },
    }))
  }

  if (!loaded) return null

  const currentThemeId = settings.appearance?.themeId ?? DEFAULT_SETTINGS.appearance!.themeId

  return (
    <div
      data-testid={TEST_IDS.SETTINGS_DIALOG}
      className="settings-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel() }}
    >
      <div className="settings-dialog">
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close-btn" onClick={handleCancel}>&times;</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === SettingsTab.General ? 'active' : ''}`}
            onClick={() => setActiveTab(SettingsTab.General)}
          >
            General
          </button>
          <button
            className={`settings-tab ${activeTab === SettingsTab.Appearance ? 'active' : ''}`}
            onClick={() => setActiveTab(SettingsTab.Appearance)}
          >
            Appearance
          </button>
        </div>

        <div className="settings-body">
          {activeTab === SettingsTab.General && (
            <GeneralTab
              settings={settings}
              setSettings={setSettings}
              updateLLM={updateLLM}
              updateRag={updateRag}
              updateAgent={updateAgent}
              handleReindex={handleReindex}
              handleReindexFile={handleReindexFile}
              isIndexing={isIndexing}
              selectedFile={selectedFile}
              vaultPath={vaultPath}
              statusText={statusText}
            />
          )}
          {activeTab === SettingsTab.Appearance && (
            <AppearanceTab
              currentThemeId={currentThemeId}
              onSelectTheme={handleThemeSelect}
            />
          )}
        </div>

        <div className="settings-footer">
          <button
            data-testid={TEST_IDS.SETTINGS_CANCEL_BTN}
            className="toolbar-btn"
            onClick={handleCancel}
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

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

interface GeneralTabProps {
  settings: AppSettings
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>
  updateLLM: <K extends keyof AppSettings['llm']>(key: K, value: AppSettings['llm'][K]) => void
  updateRag: <K extends keyof AppSettings['rag']>(key: K, value: AppSettings['rag'][K]) => void
  updateAgent: <K extends keyof AppSettings['agent']>(key: K, value: AppSettings['agent'][K]) => void
  handleReindex: () => void
  handleReindexFile: () => void
  isIndexing: boolean
  selectedFile: string | null
  vaultPath: string | null
  statusText: string
}

function GeneralTab({
  settings, setSettings, updateLLM, updateRag, updateAgent,
  handleReindex, handleReindexFile, isIndexing,
  selectedFile, vaultPath, statusText,
}: GeneralTabProps) {
  return (
    <>
      {/* LLM Configuration */}
      <div className="settings-section">
        <div className="settings-section-title">LLM Configuration</div>
        <LLMProviderField settings={settings} updateLLM={updateLLM} />
        {settings.llm.provider !== 'ollama' && settings.llm.provider !== 'claude-code' && settings.llm.provider !== 'codex' && (
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
        <LLMModelField settings={settings} updateLLM={updateLLM} />
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

      {/* Agent */}
      <div className="settings-section">
        <div className="settings-section-title">Agent</div>
        <AgentProviderField settings={settings} updateAgent={updateAgent} />
        <AgentTransportField settings={settings} updateAgent={updateAgent} />
        <AgentModelField settings={settings} updateAgent={updateAgent} />
        {settings.agent.transport === 'tty' && (
          <div className="settings-field">
            <label>Claude CLI Path</label>
            <input
              className="settings-input"
              type="text"
              value={settings.agent.claudeCliPath ?? ''}
              onChange={e => updateAgent('claudeCliPath', e.target.value)}
              placeholder="claude (or absolute path)"
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

      {/* Generated Documents */}
      <div className="settings-section">
        <div className="settings-section-title">Generated Documents</div>
        <div className="settings-field">
          <label>Retention (days)</label>
          <input
            className="settings-input"
            data-testid={TEST_IDS.GENERATED_DOCS_RETENTION_INPUT}
            type="number"
            value={settings.generatedDocs?.retentionDays ?? 7}
            onChange={(e) => setSettings((prev) => ({
              ...prev,
              generatedDocs: { ...prev.generatedDocs, retentionDays: Math.max(1, Number(e.target.value)) }
            }))}
            min={1}
          />
        </div>
      </div>

      {/* Excluded Folders */}
      <div className="settings-section">
        <div className="settings-section-title">Excluded Folders</div>
        {settings.excludedFolders.length === 0 ? (
          <div className="settings-excluded-empty">
            No folders excluded. Right-click a folder in the file tree to exclude it.
          </div>
        ) : (
          <div className="settings-excluded-list">
            {settings.excludedFolders.map((folder) => (
              <div key={folder} className="settings-excluded-item">
                <span className="settings-excluded-path">{folder}</span>
                <button
                  className="settings-excluded-remove"
                  onClick={() => {
                    setSettings(prev => ({
                      ...prev,
                      excludedFolders: prev.excludedFolders.filter(f => f !== folder)
                    }))
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// LLM sub-fields (extracted to keep GeneralTab under ~30 lines of JSX logic)
// ---------------------------------------------------------------------------

interface LLMFieldProps {
  settings: AppSettings
  updateLLM: <K extends keyof AppSettings['llm']>(key: K, value: AppSettings['llm'][K]) => void
}

function LLMProviderField({ settings, updateLLM }: LLMFieldProps) {
  return (
    <div className="settings-field">
      <label>Provider</label>
      <select
        className="settings-select"
        value={settings.llm.provider}
        onChange={e => {
          const newProvider = e.target.value as AppSettings['llm']['provider']
          updateLLM('provider', newProvider)
          updateLLM('model', DEFAULT_MODELS[newProvider] ?? '')
        }}
      >
        <option value="claude-code">Claude Code (subscription)</option>
        <option value="codex">Codex (subscription)</option>
        <option value="anthropic">Anthropic (API key)</option>
        <option value="openai">OpenAI (API key)</option>
        <option value="ollama">Ollama (local)</option>
      </select>
    </div>
  )
}

function LLMModelField({ settings, updateLLM }: LLMFieldProps) {
  const presets = PROVIDER_MODELS[settings.llm.provider] ?? []
  const isPreset = presets.some((p) => p.id === settings.llm.model)
  const isCustom = !isPreset && settings.llm.model !== ''
  const selectValue = isCustom ? '__custom' : settings.llm.model

  return (
    <div className="settings-field">
      <label>Model</label>
      <select
        className="settings-select"
        value={selectValue}
        onChange={e => {
          if (e.target.value === '__custom') {
            updateLLM('model', '')
          } else {
            updateLLM('model', e.target.value)
          }
        }}
      >
        {presets.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
        <option value="__custom">Custom...</option>
      </select>
      {(selectValue === '__custom' || isCustom) && (
        <input
          className="settings-input"
          type="text"
          value={settings.llm.model}
          onChange={e => updateLLM('model', e.target.value)}
          placeholder="Enter custom model name"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agent sub-fields
// ---------------------------------------------------------------------------

interface AgentFieldProps {
  settings: AppSettings
  updateAgent: <K extends keyof AppSettings['agent']>(key: K, value: AppSettings['agent'][K]) => void
}

function AgentProviderField({ settings, updateAgent }: AgentFieldProps) {
  return (
    <div className="settings-field">
      <label>Provider</label>
      <select
        className="settings-select"
        value={settings.agent.provider}
        onChange={e => updateAgent('provider', e.target.value as AppSettings['agent']['provider'])}
      >
        <option value="claude-code">Claude Code</option>
      </select>
    </div>
  )
}

function AgentTransportField({ settings, updateAgent }: AgentFieldProps) {
  return (
    <div className="settings-field">
      <label>Transport</label>
      <select
        className="settings-select"
        value={settings.agent.transport}
        onChange={e => updateAgent('transport', e.target.value as AppSettings['agent']['transport'])}
      >
        <option value="npm">NPM SDK (in-process)</option>
        <option value="tty">Claude CLI (subprocess)</option>
      </select>
    </div>
  )
}

function AgentModelField({ settings, updateAgent }: AgentFieldProps) {
  return (
    <div className="settings-field">
      <label>Model</label>
      <input
        className="settings-input"
        type="text"
        value={settings.agent.model}
        onChange={e => updateAgent('model', e.target.value)}
        placeholder="claude-sonnet-4-6"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance Tab
// ---------------------------------------------------------------------------

interface AppearanceTabProps {
  currentThemeId: string
  onSelectTheme: (id: ThemeId) => void
}

function AppearanceTab({ currentThemeId, onSelectTheme }: AppearanceTabProps) {
  const darkThemes = THEMES.filter((t) => t.group === ThemeGroup.Dark)
  const lightThemes = THEMES.filter((t) => t.group === ThemeGroup.Light)

  return (
    <>
      <div className="theme-group">
        <div className="theme-group-title">Dark</div>
        <div className="theme-grid">
          {darkThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === currentThemeId}
              onSelect={() => onSelectTheme(theme.id)}
            />
          ))}
        </div>
      </div>
      <div className="theme-group">
        <div className="theme-group-title">Light</div>
        <div className="theme-grid">
          {lightThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === currentThemeId}
              onSelect={() => onSelectTheme(theme.id)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Theme Card
// ---------------------------------------------------------------------------

interface ThemeCardProps {
  theme: (typeof THEMES)[number]
  isActive: boolean
  onSelect: () => void
}

function ThemeCard({ theme, isActive, onSelect }: ThemeCardProps) {
  const { bgBase, bgSurface, textPrimary, accent } = theme.colors
  const previewColors = [bgBase, bgSurface, textPrimary, accent]

  return (
    <button
      className={`theme-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <div className="theme-card-preview">
        {previewColors.slice(0, PREVIEW_BAR_COUNT).map((color, i) => (
          <div
            key={i}
            className="theme-card-preview-bar"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="theme-card-label">{theme.label}</span>
    </button>
  )
}
