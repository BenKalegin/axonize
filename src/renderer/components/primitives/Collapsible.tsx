import { ReactNode, useState } from 'react'

interface CollapsibleProps {
  /** The header/trigger content */
  trigger: ReactNode | ((open: boolean) => ReactNode)
  /** The collapsible content */
  children: ReactNode
  /** Initial open state (default: false) */
  defaultOpen?: boolean
  /** Controlled open state (optional) */
  open?: boolean
  /** Controlled state setter (optional) */
  onOpenChange?: (open: boolean) => void
  /** Optional CSS class for the container */
  className?: string
  /** Optional CSS class for the trigger button */
  triggerClassName?: string
  /** Optional CSS class for the content area */
  contentClassName?: string
}

/**
 * Reusable Collapsible/Accordion component
 * Can be used as controlled or uncontrolled component
 */
export function Collapsible({
  trigger,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  triggerClassName,
  contentClassName,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)

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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const triggerContent = typeof trigger === 'function' ? trigger(isOpen) : trigger

  return (
    <div className={className}>
      <button className={triggerClassName} onClick={handleToggle}>
        {triggerContent}
      </button>
      {isOpen && <div className={contentClassName}>{children}</div>}
    </div>
  )
}

interface CollapsibleWithChevronProps extends Omit<CollapsibleProps, 'trigger'> {
  /** The header content (without chevron) */
  header: ReactNode
  /** Chevron position (default: 'left') */
  chevronPosition?: 'left' | 'right'
  /** Custom chevron icons */
  chevronIcons?: {
    open: ReactNode
    closed: ReactNode
  }
}

/**
 * Collapsible with a standard chevron icon
 */
export function CollapsibleWithChevron({
  header,
  chevronPosition = 'left',
  chevronIcons = { open: '▾', closed: '▸' },
  ...props
}: CollapsibleWithChevronProps) {
  const trigger = (isOpen: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {chevronPosition === 'left' && (
        <span>{isOpen ? chevronIcons.open : chevronIcons.closed}</span>
      )}
      {header}
      {chevronPosition === 'right' && (
        <span>{isOpen ? chevronIcons.open : chevronIcons.closed}</span>
      )}
    </div>
  )

  return <Collapsible {...props} trigger={trigger} />
}
