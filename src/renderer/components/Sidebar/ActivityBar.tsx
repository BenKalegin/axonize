import { TEST_IDS } from '../../lib/testids'
import { useLayoutStore, type SidePanelId } from '../../store/layout-store'

interface ActivityItem {
  id: SidePanelId
  label: string
  icon: JSX.Element
}

const FilesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm6.5 1H5v14h10V6.5h-3.5V3zM7 10h6v1H7v-1zm0 3h6v1H7v-1z" />
  </svg>
)

const LLMLogIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="5" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="18" r="1" fill="currentColor" />
  </svg>
)

const ACTIVITY_ITEMS: ActivityItem[] = [
  { id: 'files', label: 'Explorer', icon: <FilesIcon /> },
  { id: 'llm-log', label: 'LLM Log', icon: <LLMLogIcon /> }
]

export function ActivityBar() {
  const { activePanelId, togglePanel } = useLayoutStore()

  return (
    <div className="activity-bar" data-testid={TEST_IDS.ACTIVITY_BAR}>
      {ACTIVITY_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`activity-bar-btn${activePanelId === item.id ? ' active' : ''}`}
          title={item.label}
          onClick={() => togglePanel(item.id)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  )
}
