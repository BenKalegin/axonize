import { describe, expect, it } from 'vitest'
import { defaultLightTheme, routeEdges } from '@benkalegin/doodles-api'
import {
  importMermaidFlowchartWithAxonizeLayout,
  renderMermaidWithDoodles,
} from '../../../src/renderer/lib/doodles-render'

const CONTENT_PADDING = 24
const RECTANGLE_DIMENSIONS = 2
type Point = { x: number; y: number }
type Bounds = Point & { width: number; height: number }

function svgBounds(svg: string): Bounds {
  const root = svg.match(/^<svg\b[^>]*>/)![0]
  const [x, y, width, height] = root.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number)
  expect(Number(root.match(/\bwidth="([^"]+)"/)![1])).toBe(width)
  expect(Number(root.match(/\bheight="([^"]+)"/)![1])).toBe(height)
  return { x, y, width, height }
}

function expectContains(viewport: Bounds, point: Point): void {
  expect(point.x).toBeGreaterThanOrEqual(viewport.x + CONTENT_PADDING)
  expect(point.y).toBeGreaterThanOrEqual(viewport.y + CONTENT_PADDING)
  expect(point.x).toBeLessThanOrEqual(viewport.x + viewport.width - CONTENT_PADDING)
  expect(point.y).toBeLessThanOrEqual(viewport.y + viewport.height - CONTENT_PADDING)
}

describe('Doodles flowchart viewport', () => {
  it.each(['LR', 'TB'])('fits a short %s chain to its nodes instead of the editor canvas', async (direction) => {
    const source = `flowchart ${direction}
      SRC[Source service] --> STREAM[(Event stream)]
      STREAM --> WORKER[Event consumer]
      WORKER --> OUT[Processing]`
    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const structure = diagram as typeof diagram & { nodes: Record<string, { bounds: Bounds }> }
    const boxes = Object.values(structure.nodes).map((node) => node.bounds)
    const viewport = svgBounds(await renderMermaidWithDoodles(source))
    const left = Math.min(...boxes.map((box) => box.x))
    const top = Math.min(...boxes.map((box) => box.y))
    const right = Math.max(...boxes.map((box) => box.x + box.width))
    const bottom = Math.max(...boxes.map((box) => box.y + box.height))
    expect(viewport).toEqual({
      x: left - CONTENT_PADDING,
      y: top - CONTENT_PADDING,
      width: right - left + CONTENT_PADDING * RECTANGLE_DIMENSIONS,
      height: bottom - top + CONTENT_PADDING * RECTANGLE_DIMENSIONS,
    })
  })

  it('keeps cluster borders, feedback routes and edge labels inside the cropped viewport', async () => {
    const source = `flowchart LR
      subgraph Workers[Processing workers]
        A[Receive] --> B[Transform] --> C[Store]
      end
      C -->|retry rejected records| A
      C -->|publish processing result| D[Delivery]`
    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const structure = diagram as typeof diagram & {
      nodes: Record<string, { bounds: Bounds }>
      elements: Record<string, { axonizeRoutePolyline?: Point[]; axonizeRouteLabelOffset?: Point }>
    }
    const viewport = svgBounds(await renderMermaidWithDoodles(source))
    for (const { bounds } of Object.values(structure.nodes)) {
      expectContains(viewport, bounds)
      expectContains(viewport, { x: bounds.x + bounds.width, y: bounds.y + bounds.height })
    }
    for (const route of routeEdges(diagram as never, defaultLightTheme)) {
      const repair = structure.elements[route.edgeId]
      for (const point of repair.axonizeRoutePolyline ?? route.polyline) expectContains(viewport, point)
      if (!route.labelBox) continue
      const { x, y, width, height } = route.labelBox
      const offset = repair.axonizeRouteLabelOffset ?? { x: 0, y: 0 }
      expectContains(viewport, { x: x + offset.x, y: y + offset.y })
      expectContains(viewport, { x: x + width + offset.x, y: y + height + offset.y })
    }
  })
})
