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

const ACTIVITY_ITEMS: ActivityItem[] = [
  { id: 'files', label: 'Explorer', icon: <FilesIcon /> }
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
