import { useEffect, useCallback } from 'react'
import { TEST_IDS } from '@/lib/testids'

interface ConflictDialogProps {
  onOverride: () => void
  onReload: () => void
}

export function ConflictDialog({ onOverride, onReload }: ConflictDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onReload()
    },
    [onReload]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="settings-overlay"
      data-testid={TEST_IDS.CONFLICT_DIALOG}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onReload()
      }}
    >
      <div className="settings-dialog conflict-dialog">
        <div className="settings-header">
          <span>File Changed Externally</span>
        </div>
        <div className="settings-body">
          <p className="conflict-message">
            This file has been modified outside the editor. What would you like to do?
          </p>
        </div>
        <div className="settings-footer">
          <button
            className="toolbar-btn"
            data-testid={TEST_IDS.CONFLICT_RELOAD_BTN}
            onClick={onReload}
          >
            Reload
          </button>
          <button
            className="toolbar-btn active"
            data-testid={TEST_IDS.CONFLICT_OVERRIDE_BTN}
            onClick={onOverride}
          >
            Override
          </button>
        </div>
      </div>
    </div>
  )
}
