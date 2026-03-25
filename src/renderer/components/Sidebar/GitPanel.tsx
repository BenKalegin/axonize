import { useCallback, useEffect, useMemo } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useGitStore } from '@/store/git-store'
import { useVaultStore } from '@/store/vault-store'
import { GitStatus } from '@core/git/types'
import type { GitFileStatus } from '@core/git/types'

const REFRESH_INTERVAL_MS = 5000

const STATUS_COLORS: Record<string, string> = {
  [GitStatus.Modified]: 'var(--git-modified, #d19a66)',
  [GitStatus.Added]: 'var(--git-added, #98c379)',
  [GitStatus.Deleted]: 'var(--git-deleted, #e06c75)',
  [GitStatus.Untracked]: 'var(--git-untracked, #7f848e)',
  [GitStatus.Renamed]: 'var(--git-renamed, #61afef)',
  [GitStatus.Copied]: 'var(--git-copied, #61afef)',
}

const STATUS_CODES: Record<string, string> = {
  [GitStatus.Modified]: 'M',
  [GitStatus.Added]: 'A',
  [GitStatus.Deleted]: 'D',
  [GitStatus.Untracked]: 'U',
  [GitStatus.Renamed]: 'R',
  [GitStatus.Copied]: 'C',
}

const StatusIcon = ({ status }: { status: string }) => {
  const color = STATUS_COLORS[status] ?? 'var(--text-muted)'
  return <span className="git-file-status-badge" style={{ color }}>{STATUS_CODES[status] ?? '?'}</span>
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

function FileRow({
  file,
  onToggle
}: {
  file: GitFileStatus
  onToggle: (path: string, staged: boolean) => void
}) {
  const handleClick = useCallback(() => {
    onToggle(file.path, file.staged)
  }, [file.path, file.staged, onToggle])

  return (
    <div className="git-file-row" data-testid={TEST_IDS.GIT_FILE_ROW}>
      <StatusIcon status={file.status} />
      <span className="git-file-name" title={file.path}>{fileName(file.path)}</span>
      <span className="git-file-path" title={file.path}>{file.path}</span>
      <button
        className="git-file-action"
        title={file.staged ? 'Unstage' : 'Stage'}
        onClick={handleClick}
      >
        {file.staged ? '−' : '+'}
      </button>
    </div>
  )
}

function SectionHeader({
  title,
  count,
  isStage,
  onAction
}: {
  title: string
  count: number
  isStage: boolean
  onAction: () => void
}) {
  return (
    <div className="git-section-header">
      <span>{title} ({count})</span>
      {count > 0 && (
        <button
          className="git-section-action"
          title={isStage ? 'Stage All' : 'Unstage All'}
          onClick={onAction}
        >
          {isStage ? '+' : '−'}
        </button>
      )}
    </div>
  )
}

export function GitPanel() {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const {
    isRepo,
    files,
    commitMessage,
    isLoading,
    isSuggesting,
    isCommitting,
    error,
    checkIsRepo,
    refresh,
    stage,
    unstage,
    stageAll,
    unstageAll,
    commit,
    suggestMessage,
    setCommitMessage,
    clearError
  } = useGitStore()

  useEffect(() => {
    if (!vaultPath) return
    checkIsRepo(vaultPath)
  }, [vaultPath, checkIsRepo])

  useEffect(() => {
    if (!isRepo) return
    const interval = setInterval(() => refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isRepo, refresh])

  const staged = useMemo(() => files.filter((f) => f.staged), [files])
  const unstaged = useMemo(() => files.filter((f) => !f.staged), [files])

  const handleToggle = useCallback(
    (path: string, isStaged: boolean) => {
      if (isStaged) {
        unstage(path)
      } else {
        stage(path)
      }
    },
    [stage, unstage]
  )

  if (!vaultPath) {
    return (
      <div className="git-panel" data-testid={TEST_IDS.GIT_PANEL}>
        <div className="sidebar-header">
          <span>Git</span>
        </div>
        <div className="git-empty">Open a vault to use version control</div>
      </div>
    )
  }

  if (!isRepo) {
    return (
      <div className="git-panel" data-testid={TEST_IDS.GIT_PANEL}>
        <div className="sidebar-header">
          <span>Git</span>
        </div>
        <div className="git-empty">Not a git repository</div>
      </div>
    )
  }

  const hasStaged = staged.length > 0
  const canCommit = hasStaged && commitMessage.trim().length > 0 && !isCommitting

  return (
    <div className="git-panel" data-testid={TEST_IDS.GIT_PANEL}>
      <div className="sidebar-header git-header">
        <span>Source Control</span>
        <button
          className="git-refresh-btn"
          title="Refresh"
          onClick={refresh}
          disabled={isLoading}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.45 2.55a8 8 0 0 0-12.17 1L0 2v5h5L3.26 5.26a6 6 0 0 1 9.48.74l1.71-1a8 8 0 0 0-1-2.45zM16 9h-5l1.74 1.74a6 6 0 0 1-9.48-.74l-1.71 1a8 8 0 0 0 13.17-1L16 14V9z" />
          </svg>
        </button>
      </div>

      <div className="git-commit-area">
        <div className="git-commit-input-row">
          <textarea
            className="git-commit-input"
            data-testid={TEST_IDS.GIT_COMMIT_INPUT}
            placeholder="Commit message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            rows={3}
          />
        </div>
        <div className="git-commit-actions">
          <button
            className="git-commit-btn"
            data-testid={TEST_IDS.GIT_COMMIT_BTN}
            disabled={!canCommit}
            onClick={commit}
            title={!hasStaged ? 'Stage changes first' : !commitMessage.trim() ? 'Enter a commit message' : 'Commit staged changes'}
          >
            {isCommitting ? 'Committing...' : 'Commit'}
          </button>
          <button
            className="git-suggest-btn"
            data-testid={TEST_IDS.GIT_SUGGEST_BTN}
            disabled={!hasStaged || isSuggesting}
            onClick={suggestMessage}
            title="Generate commit message with AI"
          >
            {isSuggesting ? (
              <span className="git-suggest-spinner">&#x27F3;</span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a1 1 0 0 1 1 1v2.6l1.8-1.8a1 1 0 1 1 1.4 1.4L10.4 6H13a1 1 0 1 1 0 2h-2.6l1.8 1.8a1 1 0 1 1-1.4 1.4L9 9.4V12a1 1 0 1 1-2 0V9.4l-1.8 1.8a1 1 0 1 1-1.4-1.4L5.6 8H3a1 1 0 0 1 0-2h2.6L3.8 4.2a1 1 0 0 1 1.4-1.4L7 4.6V2a1 1 0 0 1 1-1z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="git-error" onClick={clearError} title="Click to dismiss">
          {error}
        </div>
      )}

      <div className="git-section">
        <SectionHeader
          title="Staged Changes"
          count={staged.length}
          isStage={false}
          onAction={unstageAll}
        />
        <div className="git-file-list">
          {staged.map((f) => (
            <FileRow key={`s-${f.path}`} file={f} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      <div className="git-section">
        <SectionHeader
          title="Changes"
          count={unstaged.length}
          isStage={true}
          onAction={stageAll}
        />
        <div className="git-file-list">
          {unstaged.map((f) => (
            <FileRow key={`u-${f.path}`} file={f} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      {files.length === 0 && !isLoading && (
        <div className="git-empty">No changes</div>
      )}
    </div>
  )
}
