import { useCallback, useRef } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useGraphStore } from '@/store/graph-store'
import { useLayoutStore } from '@/store/layout-store'

export function PropertiesPanel() {
  const { cards, relations, hoveredNodeId } = useGraphStore()
  const { rightPanelWidth, setRightPanelWidth } = useLayoutStore()
  const selectedCard = cards.find((c) => c.id === hoveredNodeId)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = rightPanelWidth
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [rightPanelWidth]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      setRightPanelWidth(startWidth.current + delta)
    },
    [setRightPanelWidth]
  )

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const connectedRelations = selectedCard
    ? relations.filter((r) => r.sourceId === selectedCard.id || r.targetId === selectedCard.id)
    : []

  return (
    <div className="properties-panel" data-testid={TEST_IDS.PROPERTIES_PANEL} style={{ position: 'relative' }}>
      <div
        className="resize-handle resize-handle-left"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="sidebar-header">Properties</div>
      {selectedCard ? (
        <div className="properties-content">
          <div className="property-row">
            <span className="property-label">Title</span>
            <span data-testid={TEST_IDS.PROPERTY_TITLE}>{selectedCard.title}</span>
          </div>
          <div className="property-row">
            <span className="property-label">Level</span>
            <span data-testid={TEST_IDS.PROPERTY_TYPE}>{selectedCard.level}</span>
          </div>
          <div className="property-row">
            <span className="property-label">Path</span>
            <span data-testid={TEST_IDS.PROPERTY_PATH}>{selectedCard.filePath}</span>
          </div>
          <div className="property-row">
            <span className="property-label">Relations</span>
            <span data-testid={TEST_IDS.PROPERTY_EDGES}>{connectedRelations.length}</span>
          </div>
          {connectedRelations.length > 0 && (
            <div className="property-edges-list">
              {connectedRelations.map((r, i) => (
                <div key={i} className="property-edge-item">
                  <span className={`edge-type edge-type-${r.type}`}>{r.type}</span>
                  <span className="edge-target">
                    {r.sourceId === selectedCard.id
                      ? cards.find((c) => c.id === r.targetId)?.title ?? r.targetId
                      : cards.find((c) => c.id === r.sourceId)?.title ?? r.sourceId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="properties-empty">No selection</div>
      )}
    </div>
  )
}
