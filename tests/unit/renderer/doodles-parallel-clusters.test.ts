import { describe, expect, it } from 'vitest'
import { defaultLightTheme, inflate, layoutFor, routeEdges, segmentEntersRect } from '@benkalegin/doodles-api'
import { importMermaidFlowchartWithAxonizeLayout } from '../../../src/renderer/lib/doodles-render'

const PARALLEL_PIPELINES = `flowchart LR
  subgraph SOURCE[Source system]
    DOC[Document mutation]
    RAW[(Raw document storage)]
    OLD[Build legacy event<br/>metadata / rendered text]
    NEW[Build next event<br/>raw URI + lifecycle metadata]
    DOC --> RAW
    DOC --> OLD
    DOC --> NEW
  end
  STREAM1[(Legacy event stream)]
  STREAM2[(Next event stream)]
  OLD --> STREAM1
  NEW --> STREAM2
  subgraph LEGACY[Legacy pipeline]
    READ1[Legacy consumer]
    BUILD1[Current chunk/index path]
    INDEX1[(Legacy search indexes)]
    READ1 --> BUILD1 --> INDEX1
  end
  subgraph NEXT[Next pipeline]
    READ2[Supported consumer<br/>validate + durable admission]
    FLOW[Ingestion orchestration]
    PARSE[Document parser<br/>reading order + tables + images]
    EMBED[Chunking + embeddings]
    INDEX2[(Next search indexes)]
    READ2 --> FLOW --> PARSE --> EMBED --> INDEX2
  end
  STREAM1 --> READ1
  STREAM2 --> READ2
  RAW --> FLOW
  CLIENT[Assistant / gateway] --> ROUTE{Workspace/app route}
  ROUTE --> INDEX1
  ROUTE --> AGENT[Agent loop]
  AGENT --> INDEX2
  AGENT -. First phase reads existing indexes .-> INDEX1
  AGENT -->|Streaming progress + answer| CLIENT`

type Bounds = { x: number; y: number; width: number; height: number }
type Structure = Awaited<ReturnType<typeof importMermaidFlowchartWithAxonizeLayout>> & {
  elements: Record<string, { id: string; sourceId?: string; text?: string; memberNodeIds?: string[] }>
  nodes: Record<string, { bounds: Bounds }>
}
const ENDPOINT_INSET = 1
const MAX_PIPELINE_GAP = 120

function sourceNode(diagram: Structure, sourceId: string) {
  return Object.values(diagram.elements).find((element) => element.sourceId === sourceId)!
}

function expectClusterContainsMembers(diagram: Structure, clusterId: string): void {
  const bounds = diagram.nodes[clusterId].bounds
  for (const id of diagram.elements[clusterId].memberNodeIds!) {
    const child = diagram.nodes[id].bounds
    expect(child.x).toBeGreaterThanOrEqual(bounds.x)
    expect(child.y).toBeGreaterThanOrEqual(bounds.y)
    expect(child.x + child.width).toBeLessThanOrEqual(bounds.x + bounds.width)
    expect(child.y + child.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  }
}

describe('Doodles parallel pipeline layout', () => {
  it('never routes a decision edge back through its own node', async () => {
    const diagram = await importMermaidFlowchartWithAxonizeLayout(PARALLEL_PIPELINES) as Structure
    const node = sourceNode(diagram, 'ROUTE')
    const interior = inflate(diagram.nodes[node.id].bounds, -ENDPOINT_INSET, -ENDPOINT_INSET)
    const routes = routeEdges(diagram as never, defaultLightTheme).filter((route) => route.sourceNodeId === node.id)
    for (const route of routes) {
      for (let index = 1; index < route.polyline.length; index++) {
        expect(segmentEntersRect(route.polyline[index - 1], route.polyline[index], interior)).toBe(false)
      }
    }
  })

  it('places the independent longer pipeline near its input stream', async () => {
    const diagram = await importMermaidFlowchartWithAxonizeLayout(PARALLEL_PIPELINES) as Structure
    const cluster = Object.values(diagram.elements).find((element) => element.text === 'Next pipeline')!
    const bounds = diagram.nodes[cluster.id].bounds
    const stream = diagram.nodes[sourceNode(diagram, 'STREAM2').id].bounds
    expect(bounds.x - stream.x - stream.width).toBeLessThanOrEqual(MAX_PIPELINE_GAP)
    expect(bounds.x).toBeGreaterThan(stream.x + stream.width)
    const legacy = Object.values(diagram.elements).find((element) => element.text === 'Legacy pipeline')!
    expect(bounds.x).toBe(diagram.nodes[legacy.id].bounds.x)
    expect(bounds.y + bounds.height).toBeLessThan(diagram.nodes[legacy.id].bounds.y)
    expectClusterContainsMembers(diagram, cluster.id)
    expectClusterContainsMembers(diagram, legacy.id)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    layoutFor(diagram as never, { routes }).edges().noNodeIntersection()
  })
})
