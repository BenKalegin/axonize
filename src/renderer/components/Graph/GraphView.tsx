import { useCallback, useEffect, useRef } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { ForceGraph } from './ForceGraph'
import { useGraphStore } from '../../store/graph-store'
import { useVaultStore } from '../../store/vault-store'

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { zoomLevel, zoomIn, zoomOut, cards, isLoading, ensureLoaded, buildIndex } = useGraphStore()
  const { vaultPath } = useVaultStore()

  useEffect(() => {
    if (vaultPath) {
      ensureLoaded(vaultPath)
    }
  }, [vaultPath, ensureLoaded])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      if (e.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    },
    [zoomIn, zoomOut]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleBuild = useCallback(() => {
    if (vaultPath) {
      buildIndex(vaultPath)
    }
  }, [vaultPath, buildIndex])

  const displayLevel = zoomLevel.toFixed(1)
  const hasCards = cards.length > 0

  return (
    <div ref={containerRef} className="graph-view" data-testid={TEST_IDS.GRAPH_VIEW}>
      {hasCards && (
        <div className="graph-zoom-indicator" data-testid={TEST_IDS.ZOOM_LEVEL}>
          <button
            className="zoom-indicator-btn"
            onClick={zoomOut}
            data-testid={TEST_IDS.ZOOM_OUT_BTN}
          >
            -
          </button>
          <span className="zoom-indicator-label">L{displayLevel}</span>
          <button
            className="zoom-indicator-btn"
            onClick={zoomIn}
            data-testid={TEST_IDS.ZOOM_IN_BTN}
          >
            +
          </button>
        </div>
      )}
      {isLoading && (
        <div className="graph-empty-state">
          Building semantic index...
        </div>
      )}
      {!isLoading && !hasCards && (
        <div className="graph-empty-state graph-empty-state--interactive">
          <p>No semantic cards yet.</p>
          {vaultPath && (
            <button className="graph-build-btn" onClick={handleBuild}>
              Build Semantic Index
            </button>
          )}
        </div>
      )}
      {hasCards && <ForceGraph />}
    </div>
  )
}
