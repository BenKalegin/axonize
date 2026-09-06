import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/primitives'

interface EnableEditsConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

export function EnableEditsConfirm({ onConfirm, onCancel }: EnableEditsConfirmProps) {
  return (
    <Dialog
      open={true}
      onClose={onCancel}
      className="agent-confirm-dialog"
      overlayClassName="agent-confirm-overlay"
    >
      <DialogHeader className="agent-confirm-title">
        Allow edits for this session?
      </DialogHeader>
      <DialogBody className="agent-confirm-body">
        The agent will be able to Write, Edit, MultiEdit, and run Bash commands inside the vault.
        This can modify or delete files.
      </DialogBody>
      <DialogFooter className="agent-confirm-actions">
        <button className="toolbar-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="toolbar-btn active" onClick={onConfirm}>
          Allow edits
        </button>
      </DialogFooter>
    </Dialog>
  )
}
