import { ReactNode } from 'react'
import { useEscapeKey } from '@/hooks'

interface DialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the dialog should close */
  onClose: () => void
  /** Dialog content */
  children: ReactNode
  /** Optional CSS class for the dialog container */
  className?: string
  /** Optional CSS class for the overlay */
  overlayClassName?: string
  /** Whether clicking outside should close the dialog (default: true) */
  closeOnClickOutside?: boolean
  /** Whether pressing Escape should close the dialog (default: true) */
  closeOnEscape?: boolean
}

/**
 * Reusable Dialog component with overlay, click-outside, and escape key handling
 */
export function Dialog({
  open,
  onClose,
  children,
  className = 'settings-dialog',
  overlayClassName = 'settings-overlay',
  closeOnClickOutside = true,
  closeOnEscape = true,
}: DialogProps) {
  useEscapeKey(onClose, closeOnEscape && open)

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnClickOutside && e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={overlayClassName} onMouseDown={handleOverlayClick}>
      <div className={className}>{children}</div>
    </div>
  )
}

interface DialogHeaderProps {
  children: ReactNode
  onClose?: () => void
  className?: string
}

/**
 * Dialog header with optional close button
 */
export function DialogHeader({
  children,
  onClose,
  className = 'settings-header',
}: DialogHeaderProps) {
  return (
    <div className={className}>
      <span>{children}</span>
      {onClose && (
        <button className="settings-close-btn" onClick={onClose}>
          &times;
        </button>
      )}
    </div>
  )
}

interface DialogBodyProps {
  children: ReactNode
  className?: string
}

/**
 * Dialog body content area
 */
export function DialogBody({
  children,
  className = 'settings-body',
}: DialogBodyProps) {
  return <div className={className}>{children}</div>
}

interface DialogFooterProps {
  children: ReactNode
  className?: string
}

/**
 * Dialog footer for action buttons
 */
export function DialogFooter({
  children,
  className = 'settings-footer',
}: DialogFooterProps) {
  return <div className={className}>{children}</div>
}
