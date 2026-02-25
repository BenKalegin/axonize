import { describe, it, expect } from 'vitest'
import { getZoomConfig, ZOOM_LEVELS } from '@core/zoom/zoom-levels'

describe('Zoom Levels', () => {
  it('should have 5 zoom levels', () => {
    expect(ZOOM_LEVELS).toHaveLength(5)
    expect(ZOOM_LEVELS).toEqual(['Z0', 'Z1', 'Z2', 'Z3', 'Z4'])
  })

  it('Z0 should hide labels', () => {
    const config = getZoomConfig('Z0')
    expect(config.showLabels).toBe(false)
    expect(config.nodeSize).toBe(3)
  })

  it('Z1 should show labels only', () => {
    const config = getZoomConfig('Z1')
    expect(config.showLabels).toBe(true)
    expect(config.showCards).toBe(false)
  })

  it('Z2 should show cards', () => {
    const config = getZoomConfig('Z2')
    expect(config.showLabels).toBe(true)
    expect(config.showCards).toBe(true)
    expect(config.showContent).toBe(false)
  })

  it('Z3 should show expanded content', () => {
    const config = getZoomConfig('Z3')
    expect(config.showContent).toBe(true)
    expect(config.showFullText).toBe(false)
  })

  it('Z4 should show full text', () => {
    const config = getZoomConfig('Z4')
    expect(config.showContent).toBe(true)
    expect(config.showFullText).toBe(true)
    expect(config.nodeSize).toBe(16)
  })

  it('node size should increase with zoom level', () => {
    const sizes = ZOOM_LEVELS.map(z => getZoomConfig(z).nodeSize)
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
    }
  })
})
