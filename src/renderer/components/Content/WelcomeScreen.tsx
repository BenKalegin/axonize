import { TEST_IDS } from '../../lib/testids'
import { useVaultStore } from '../../store/vault-store'

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function WelcomeScreen() {
  const { recentVaults, openVault, openRecentVault, removeRecentVault } = useVaultStore()

  return (
    <div className="welcome-screen" data-testid={TEST_IDS.WELCOME_SCREEN}>
      <div className="welcome-content">
        <h2 className="welcome-title">Axonize</h2>
        {recentVaults.length > 0 && (
          <div className="recent-vaults" data-testid={TEST_IDS.RECENT_VAULT_LIST}>
            <h3 className="recent-vaults-heading">Recent Vaults</h3>
            <ul className="recent-vault-list">
              {recentVaults.map((vault) => (
                <li
                  key={vault.path}
                  className="recent-vault-item"
                  data-testid={TEST_IDS.RECENT_VAULT_ITEM}
                  onClick={() => openRecentVault(vault.path)}
                >
                  <div className="recent-vault-info">
                    <span className="recent-vault-name">{vault.name}</span>
                    <span className="recent-vault-path">{vault.path}</span>
                  </div>
                  <div className="recent-vault-meta">
                    <span className="recent-vault-time">{formatRelativeTime(vault.openedAt)}</span>
                    <button
                      className="recent-vault-remove"
                      data-testid={TEST_IDS.RECENT_VAULT_REMOVE}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecentVault(vault.path)
                      }}
                      title="Remove from recent"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button className="toolbar-btn welcome-open-btn" onClick={openVault}>
          Open Vault
        </button>
      </div>
    </div>
  )
}
