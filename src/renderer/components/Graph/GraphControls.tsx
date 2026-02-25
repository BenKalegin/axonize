import { TEST_IDS } from '../../lib/testids'
import { useZoomStore, ZOOM_LEVELS } from '../../store/zoom-store'
import type { ZoomLevel } from '../../store/zoom-store'

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  Z0: 'Dots',
  Z1: 'Labels',
  Z2: 'Cards',
  Z3: 'Expanded',
  Z4: 'Full'
}

export function GraphControls() {
  const { level, setLevel } = useZoomStore()

  return (
    <div className="graph-controls" data-testid={TEST_IDS.GRAPH_CONTROLS}>
      {ZOOM_LEVELS.map((z) => (
        <button
          key={z}
          data-testid={`${TEST_IDS.ZOOM_BUTTON}-${z}`}
          className={`zoom-btn ${level === z ? 'active' : ''}`}
          onClick={() => setLevel(z)}
          title={ZOOM_LABELS[z]}
        >
          {z}
        </button>
      ))}
    </div>
  )
}
