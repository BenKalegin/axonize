import { describe, expect, it } from 'vitest'
import { defaultLightTheme, layoutFor, routeEdges } from '@benkalegin/doodles-api'
import { importMermaidFlowchartWithAxonizeLayout } from '../../../src/renderer/lib/doodles-render'

type Bounds = { x: number; y: number; width: number; height: number }
const STRAIGHT_EDGE_POINT_COUNT = 2
const LEFT_BRANCH_RATIO = 0.25
const RIGHT_BRANCH_RATIO = 0.75

function expectSymmetricBranchPorts(
  routes: ReturnType<typeof routeEdges>,
  page: Bounds,
  pageId: string
): void {
  const starts = routes.filter((route) => route.sourceNodeId === pageId)
    .sort((left, right) => left.polyline[left.polyline.length - 1]!.x -
      right.polyline[right.polyline.length - 1]!.x)
    .map((route) => route.polyline[0]!)
  expect(starts.map((point) => (point.x - page.x) / page.width))
    .toEqual([LEFT_BRANCH_RATIO, RIGHT_BRANCH_RATIO])
  for (const point of starts) expect(point.y).toBe(page.y + page.height)
}

describe('Doodles fan-out centering', () => {
  it.each(['TD', 'TB', 'LR'])('keeps a shared iterator centered between its children in %s', async (direction) => {
    const source = `flowchart ${direction}
      JOB[Reconciliation job] --> PAGE[Shared page iterator]
      PAGE --> RECORD[Record builder]
      RECORD --> STREAM[(Event stream)]
      PAGE --> COMMAND[Command builder]
      COMMAND --> QUEUE[(Work queue)]
      QUEUE --> TRIGGER[Existing trigger]`
    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const structure = diagram as typeof diagram & {
      elements: Record<string, { id: string; sourceId?: string }>
      nodes: Record<string, { bounds: Bounds }>
    }
    const bounds = (sourceId: string) => structure.nodes[Object.values(structure.elements)
      .find((element) => element.sourceId === sourceId)!.id].bounds
    const center = (sourceId: string) => direction === 'LR'
      ? bounds(sourceId).y + bounds(sourceId).height / 2
      : bounds(sourceId).x + bounds(sourceId).width / 2
    expect(center('PAGE')).toBeCloseTo((center('RECORD') + center('COMMAND')) / 2)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })
    if (direction === 'LR') {
      // This layout already centers the iterator; keep the off-center parent
      // in its original lane rather than moving the iterator toward it.
      expect(center('JOB')).toBeCloseTo(center('RECORD'))
    } else {
      expect(center('PAGE')).toBeCloseTo(center('JOB'))
      const pageId = Object.values(structure.elements).find((element) => element.sourceId === 'PAGE')!.id
      expectSymmetricBranchPorts(routes, bounds('PAGE'), pageId)
      layout.edge({ fromText: 'Reconciliation job', toText: 'Shared page iterator' })
        .polylineLengthAtMost(STRAIGHT_EDGE_POINT_COUNT)
    }
    layout.edges().noNodeIntersection()
  })
})
