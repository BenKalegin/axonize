import { useCallback, useRef } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useLayoutStore } from '../../store/layout-store'
import { FileExplorer } from './FileExplorer'
import { LLMLogPanel } from './LLMLogPanel'
import { SemanticErrorsPanel } from './SemanticErrorsPanel'

export function SidePanel() {
  const { activePanelId, sidePanelWidth, setSidePanelWidth, persistToSettings } =
    useLayoutStore()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = sidePanelWidth
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [sidePanelWidth]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setSidePanelWidth(startWidth.current + delta)
    },
    [setSidePanelWidth]
  )

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    persistToSettings()
  }, [persistToSettings])

  if (!activePanelId) return null

  return (
    <aside
      className="left-sidebar side-panel"
      data-testid={TEST_IDS.SIDE_PANEL}
      style={{ position: 'relative' }}
    >
      <div className="side-panel-content">
        {activePanelId === 'files' && <FileExplorer />}
        {activePanelId === 'llm-log' && <LLMLogPanel />}
        {activePanelId === 'errors' && <SemanticErrorsPanel />}
      </div>
      <div
        className="resize-handle"
        data-testid={TEST_IDS.RESIZE_HANDLE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </aside>
  )
}
