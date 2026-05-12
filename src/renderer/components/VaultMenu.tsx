import { useCallback, useEffect, useRef, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useVaultStore } from '@/store/vault-store'
import { VaultIcon } from './VaultIcon'
import type { OpenWindowInfo } from '../../preload/index'

const ICON_THUMB_SIZE_PX = 20
const ICON_TRIGGER_SIZE_PX = 16

// Replace the user's home prefix with `~` for a tighter, JetBrains-style path.
// homeDir is captured once at preload time so this is a pure string operation.
function tildify(path: string, homeDir: string): string {
  if (homeDir && path.startsWith(`${homeDir}/`)) {
    return `~${path.slice(homeDir.length)}`
  }
  return path
}

// Track per-vault icon refresh tokens. Bumping the counter for a path forces
// the VaultIcon for that path to re-fetch from disk so a freshly generated SVG
// appears immediately without remounting the whole menu.
type IconRefreshMap = Record<string, number>

interface IconPromptState {
  vaultPath: string
  prompt: string
  busy: boolean
  error: string | null
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="10"
    height="6"
    viewBox="0 0 10 6"
    fill="none"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
  >
    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const NewVaultIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const OpenFolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 4a1 1 0 0 1 1-1h3l1.2 1.2H11.5a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4z"
      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
)

const NewWindowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 3V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
)

export function VaultMenu() {
  const {
    vaultPath,
    vaultName,
    openVault,
    createNewVault,
    recentVaults,
    openRecentVault,
    openVaultInNewWindow,
    loadRecentVaults,
    removeRecentVault
  } = useVaultStore()

  const [open, setOpen] = useState(false)
  const [openWindows, setOpenWindows] = useState<OpenWindowInfo[]>([])
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [iconRefresh, setIconRefresh] = useState<IconRefreshMap>({})
  const [iconPrompt, setIconPrompt] = useState<IconPromptState | null>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirmRemove(null)
        setIconPrompt(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const openMenu = useCallback(async () => {
    await loadRecentVaults()
    const wins = await window.axonize.window.listOpen()
    setOpenWindows(wins)
    setOpen(true)
  }, [loadRecentVaults])

  const toggleMenu = useCallback(() => {
    if (open) {
      setOpen(false)
      setConfirmRemove(null)
      setIconPrompt(null)
    } else {
      openMenu().catch(() => {})
    }
  }, [open, openMenu])

  const close = useCallback(() => {
    setOpen(false)
    setConfirmRemove(null)
    setIconPrompt(null)
  }, [])

  const bumpIconRefresh = useCallback((path: string) => {
    setIconRefresh((prev) => ({ ...prev, [path]: (prev[path] ?? 0) + 1 }))
  }, [])

  const handleGenerateIcon = useCallback(async () => {
    if (!iconPrompt) return
    setIconPrompt({ ...iconPrompt, busy: true, error: null })
    try {
      await window.axonize.vault.generateIcon(iconPrompt.vaultPath, iconPrompt.prompt)
      bumpIconRefresh(iconPrompt.vaultPath)
      setIconPrompt(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Icon generation failed'
      setIconPrompt({ ...iconPrompt, busy: false, error: msg })
    }
  }, [iconPrompt, bumpIconRefresh])

  // "Open Vaults" lists every window that currently has a vault — including this
  // one, marked (current). Recent then excludes any path that is already open in
  // some window so a vault never appears in both sections.
  const openVaults = openWindows.filter((w) => w.vaultPath !== null)
  const openVaultPaths = new Set(openVaults.map((w) => w.vaultPath!))
  const recentNotOpen = recentVaults.filter((v) => !openVaultPaths.has(v.path))

  return (
    <div className="vault-btn-group" ref={groupRef}>
      <button
        data-testid={TEST_IDS.VAULT_MENU_TRIGGER}
        className="toolbar-btn vault-menu-trigger"
        onClick={toggleMenu}
      >
        {vaultPath && vaultName ? (
          <span className="vault-menu-trigger-inner">
            <VaultIcon
              vaultPath={vaultPath}
              vaultName={vaultName}
              size={ICON_TRIGGER_SIZE_PX}
              refreshToken={iconRefresh[vaultPath]}
            />
            <span data-testid={TEST_IDS.VAULT_NAME}>{vaultName}</span>
          </span>
        ) : (
          'Vault'
        )}
      </button>
      <button
        data-testid={TEST_IDS.VAULT_MENU_CHEVRON}
        className="vault-chevron"
        onClick={toggleMenu}
        aria-label="Vault menu"
      >
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div data-testid={TEST_IDS.VAULT_DROPDOWN} className="vault-dropdown vault-menu">
          {/* Section 1 — actions */}
          <div className="vault-menu-section">
            <button
              data-testid={TEST_IDS.VAULT_MENU_NEW}
              className="vault-menu-action"
              onClick={async () => {
                close()
                try {
                  await createNewVault()
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Could not create vault')
                }
              }}
            >
              <NewVaultIcon />
              <span>New Vault…</span>
            </button>
            <button
              data-testid={TEST_IDS.VAULT_MENU_OPEN}
              className="vault-menu-action"
              onClick={() => {
                close()
                openVault().catch(() => {})
              }}
            >
              <OpenFolderIcon />
              <span>Open Vault…</span>
            </button>
          </div>

          {/* Section 2 — open windows (this one + others) */}
          {openVaults.length > 0 && (
            <>
              <div className="vault-menu-separator" />
              <div className="vault-menu-section">
                <div className="vault-menu-section-label">Open Vaults</div>
                {openVaults.map((w) => (
                  <button
                    key={w.windowId}
                    data-testid={TEST_IDS.VAULT_MENU_OPEN_WINDOW}
                    className="vault-dropdown-item vault-menu-row"
                    disabled={w.isCurrent}
                    onClick={() => {
                      close()
                      if (!w.isCurrent) {
                        window.axonize.window.focus(w.windowId).catch(() => {})
                      }
                    }}
                  >
                    <VaultIcon
                      vaultPath={w.vaultPath}
                      vaultName={w.vaultName ?? '··'}
                      size={ICON_THUMB_SIZE_PX}
                    />
                    <div className="vault-dropdown-item-info">
                      <span className="vault-dropdown-item-name">{w.vaultName}</span>
                      <span className="vault-dropdown-item-path">
                        {tildify(w.vaultPath!, window.axonize.homeDir)}
                      </span>
                    </div>
                    {w.isCurrent && <span className="vault-menu-current-tag">current</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Section 3 — recent */}
          <div className="vault-menu-separator" />
          <div className="vault-menu-section">
            <div className="vault-menu-section-label">Recent</div>
            {recentNotOpen.length === 0 ? (
              <div className="vault-dropdown-empty">No recent vaults</div>
            ) : (
              recentNotOpen.map((vault) => (
                <div key={vault.path}>
                  <div data-testid={TEST_IDS.VAULT_DROPDOWN_ITEM} className="vault-dropdown-item vault-menu-row">
                    <VaultIcon
                      vaultPath={vault.path}
                      vaultName={vault.name}
                      size={ICON_THUMB_SIZE_PX}
                      refreshToken={iconRefresh[vault.path]}
                    />
                    <div
                      className="vault-dropdown-item-info"
                      onClick={() => {
                        openRecentVault(vault.path).catch(() => {})
                        close()
                      }}
                    >
                      <span className="vault-dropdown-item-name">{vault.name}</span>
                      <span className="vault-dropdown-item-path">
                        {tildify(vault.path, window.axonize.homeDir)}
                      </span>
                    </div>
                    <button
                      data-testid={TEST_IDS.VAULT_MENU_ICON_EDIT}
                      className="vault-dropdown-newwin"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIconPrompt({ vaultPath: vault.path, prompt: '', busy: false, error: null })
                      }}
                      title="Generate icon with AI"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="vault-dropdown-newwin"
                      onClick={(e) => {
                        e.stopPropagation()
                        openVaultInNewWindow(vault.path).catch(() => {})
                        close()
                      }}
                      title="Open in new window"
                    >
                      <NewWindowIcon />
                    </button>
                    <button
                      className="vault-dropdown-remove"
                      data-testid={TEST_IDS.VAULT_DROPDOWN_REMOVE}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmRemove(confirmRemove === vault.path ? null : vault.path)
                      }}
                      title="Remove from recents"
                    >
                      ×
                    </button>
                  </div>

                  {iconPrompt?.vaultPath === vault.path && (
                    <div className="vault-menu-icon-prompt">
                      <input
                        data-testid={TEST_IDS.VAULT_MENU_ICON_PROMPT}
                        type="text"
                        autoFocus
                        placeholder="Describe the icon (e.g. minimalist blue notebook)"
                        value={iconPrompt.prompt}
                        disabled={iconPrompt.busy}
                        onChange={(e) => setIconPrompt({ ...iconPrompt, prompt: e.target.value, error: null })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleGenerateIcon()
                          else if (e.key === 'Escape') setIconPrompt(null)
                        }}
                      />
                      <button
                        data-testid={TEST_IDS.VAULT_MENU_ICON_GENERATE}
                        className="vault-menu-icon-generate"
                        disabled={iconPrompt.busy}
                        onClick={handleGenerateIcon}
                      >
                        {iconPrompt.busy ? 'Generating…' : 'Generate'}
                      </button>
                      {iconPrompt.error && (
                        <div className="vault-menu-icon-error">{iconPrompt.error}</div>
                      )}
                    </div>
                  )}

                  {confirmRemove === vault.path && (
                    <div className="vault-dropdown-confirm">
                      <span>Remove {vault.name}?</span>
                      <div className="vault-dropdown-confirm-btns">
                        <button
                          className="vault-dropdown-confirm-btn vault-dropdown-confirm-btn--cancel"
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="vault-dropdown-confirm-btn vault-dropdown-confirm-btn--delete"
                          onClick={async () => {
                            await removeRecentVault(vault.path)
                            setConfirmRemove(null)
                            if (vaultPath === vault.path) {
                              useVaultStore.setState({ vaultPath: null, vaultName: null, fileTree: [] })
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
