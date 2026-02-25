import { TEST_IDS } from '../../lib/testids'

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="zoom-controls" data-testid={TEST_IDS.ZOOM_CONTROLS}>
      <button
        className="zoom-ctrl-btn"
        data-testid={TEST_IDS.ZOOM_OUT_BTN}
        onClick={onZoomOut}
        title="Zoom out"
      >
        −
      </button>
      <button
        className="zoom-level"
        data-testid={TEST_IDS.ZOOM_LEVEL}
        onClick={onReset}
        title="Reset zoom"
      >
        {zoom}%
      </button>
      <button
        className="zoom-ctrl-btn"
        data-testid={TEST_IDS.ZOOM_IN_BTN}
        onClick={onZoomIn}
        title="Zoom in"
      >
        +
      </button>
    </div>
  )
}
