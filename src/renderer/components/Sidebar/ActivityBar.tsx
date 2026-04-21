import type { ReactNode } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useLayoutStore, type SidePanelId } from '@/store/layout-store'
import { useEditorStore, ViewMode } from '@/store/editor-store'

interface ActivityItem {
  id: SidePanelId
  label: string
  icon: ReactNode
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

const ErrorsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L18 17H2L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14.5" r="0.8" fill="currentColor" />
  </svg>
)

const GitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M17.78 9.36l-7.14-7.14a.76.76 0 0 0-1.08 0L7.72 4.06l1.36 1.36a.9.9 0 0 1 1.16.17.9.9 0 0 1 .17 1.01l1.31 1.31a.91.91 0 1 1-.54.51L9.92 7.16v3.93a.91.91 0 1 1-.75-.03V7.09a.91.91 0 0 1-.49-1.19L7.35 4.57 2.22 9.7a.76.76 0 0 0 0 1.08l7.14 7.14a.76.76 0 0 0 1.08 0l7.34-7.34a.76.76 0 0 0 0-1.08z" />
  </svg>
)

const OutlineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <rect x="3" y="3" width="10" height="2" rx="0.5" />
    <rect x="6" y="7" width="10" height="2" rx="0.5" />
    <rect x="6" y="11" width="10" height="2" rx="0.5" />
    <rect x="3" y="15" width="10" height="2" rx="0.5" />
  </svg>
)

const AgentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="5" width="12" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="10" r="1" fill="currentColor" />
    <circle cx="12" cy="10" r="1" fill="currentColor" />
    <path d="M7.5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 3v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const ACTIVITY_ITEMS: ActivityItem[] = [
  { id: 'files', label: 'Explorer', icon: <FilesIcon /> },
  { id: 'git', label: 'Source Control', icon: <GitIcon /> },
  { id: 'outline', label: 'Outline', icon: <OutlineIcon /> },
  { id: 'agent', label: 'Agent Sessions', icon: <AgentIcon /> },
  { id: 'llm-log', label: 'LLM Log', icon: <LLMLogIcon /> },
  { id: 'errors', label: 'Errors', icon: <ErrorsIcon /> }
]

export function ActivityBar() {
  const { activePanelId, togglePanel } = useLayoutStore()
  const setViewMode = useEditorStore((s) => s.setViewMode)

  const handleClick = (id: SidePanelId) => {
    const opening = activePanelId !== id
    togglePanel(id)
    if (id === 'agent' && opening) {
      setViewMode(ViewMode.Agent)
    }
  }

  return (
    <div className="activity-bar" data-testid={TEST_IDS.ACTIVITY_BAR}>
      {ACTIVITY_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`activity-bar-btn${activePanelId === item.id ? ' active' : ''}`}
          title={item.label}
          onClick={() => handleClick(item.id)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  )
}
