import { ReactNode, useRef, useState } from 'react'
import { useClickOutside } from '@/hooks'

interface DropdownProps {
  /** The trigger button content */
  trigger: ReactNode
  /** The dropdown menu content */
  children: ReactNode
  /** Optional CSS class for the trigger button */
  triggerClassName?: string
  /** Optional CSS class for the dropdown menu */
  menuClassName?: string
  /** Controlled open state (optional) */
  open?: boolean
  /** Controlled state setter (optional) */
  onOpenChange?: (open: boolean) => void
}

/**
 * Reusable Dropdown component with click-outside detection
 * Can be used as controlled or uncontrolled component
 */
export function Dropdown({
  trigger,
  children,
  triggerClassName = 'folder-actions-btn',
  menuClassName = 'folder-actions-menu',
  open: controlledOpen,
  onOpenChange,
}: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const setIsOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value)
    } else {
      setUncontrolledOpen(value)
    }
  }

  useClickOutside(containerRef, () => setIsOpen(false), isOpen)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button className={triggerClassName} onClick={handleToggle}>
        {trigger}
      </button>
      {isOpen && <div className={menuClassName}>{children}</div>}
    </div>
  )
}

interface DropdownItemProps {
  onClick: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}

/**
 * Dropdown menu item
 */
export function DropdownItem({
  onClick,
  children,
  className = 'folder-action-item',
  disabled = false,
}: DropdownItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled) {
      onClick()
    }
  }

  return (
    <button
      className={`${className} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
