import { useEffect } from 'react'

interface EnableEditsConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

export function EnableEditsConfirm({ onConfirm, onCancel }: EnableEditsConfirmProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="agent-confirm-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="agent-confirm-dialog">
        <div className="agent-confirm-title">Allow edits for this session?</div>
        <div className="agent-confirm-body">
          The agent will be able to Write, Edit, MultiEdit, and run Bash commands inside the vault.
          This can modify or delete files.
        </div>
        <div className="agent-confirm-actions">
          <button className="toolbar-btn" onClick={onCancel}>Cancel</button>
          <button className="toolbar-btn active" onClick={onConfirm}>Allow edits</button>
        </div>
      </div>
    </div>
  )
}
