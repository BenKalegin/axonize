import type { ReactNode } from 'react'
import { useLayoutStore, type RightPanelId } from '@/store/layout-store'

interface RightActivityItem {
  id: RightPanelId
  label: string
  icon: ReactNode
}

const PropertiesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="7" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const RelatedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
    <line x1="8.5" y1="8.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const RIGHT_ACTIVITY_ITEMS: RightActivityItem[] = [
  { id: 'properties', label: 'Properties', icon: <PropertiesIcon /> },
  { id: 'related', label: 'Related', icon: <RelatedIcon /> }
]

export function RightActivityBar() {
  const { activeRightPanelId, toggleRightPanel } = useLayoutStore()

  return (
    <div className="activity-bar activity-bar--right">
      {RIGHT_ACTIVITY_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`activity-bar-btn${activeRightPanelId === item.id ? ' active' : ''}`}
          title={item.label}
          onClick={() => toggleRightPanel(item.id)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  )
}
