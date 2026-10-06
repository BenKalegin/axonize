import { describe, expect, it } from 'vitest'
import { importMermaidFlowchartWithAxonizeLayout } from '../../../src/renderer/lib/doodles-render'
import { defaultLightTheme, routeEdges, ElementType } from '@benkalegin/doodles-api'

// Regression: makeRoomForForwardEdgeLabels skips compound diagrams, so labels on
// edges that cross between cluster columns used to collide with the cluster
// rectangles whenever the inter-cluster gap was narrower than the label. The
// compound gap-widening + label recentering must keep those labels clear.
const SOURCE = `flowchart LR
subgraph GENAI["generative-ai-chat"]
RA["ResearchAgent<br/>(Modern — path of record)"]
AQT["QuestionAnswerTool / AQT<br/>(deprecated client)"]
end
subgraph MCPSRV["idm-mcpserver-search (FastMCP, ECS)"]
MCP["idm_semantic_search tool"]
end
subgraph IDM["IDM"]
GS["/api/genai/search<br/>GenAISearchService"]
end
subgraph GEN3S["Gen3S / inforsearchvs"]
V1["/api/v1/search/vectorsearch<br/>ACL + filters map"]
V2["/api/v2/search/vectorsearch<br/>CQL filterCondition"]
V3["/v3/search/vectorsearch<br/>securityTokens; no boostFactor"]
end
RA -->|"MCP (Streamable HTTP, ION gw)"| MCP
MCP -->|"POST GenAIUserRequest"| GS
AQT -.->|"REST (deprecated)"| GS
GS -->|"V1: criteria-eval OFF"| V1
GS -->|"V2: criteria-eval ON"| V2
V3 -.->|"no IDM caller"| NOUSE["consumer untraced"]`

interface Rect { x: number; y: number; width: number; height: number }

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

describe('doodles compound label clearance', () => {
  it('keeps cross-cluster edge labels off nodes and cluster rectangles', async () => {
    const diagram = (await importMermaidFlowchartWithAxonizeLayout(SOURCE)) as never as {
      elements: Record<string, {
        type: number
        sourceId?: string
        port1?: string
        port2?: string
        nodeId?: string
        axonizeRouteLabelOffset?: { x: number; y: number }
      }>
      nodes: Record<string, { bounds?: Rect }>
    }
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const clusters = Object.values(diagram.elements)
      .filter((e) => e.type === ElementType.Cluster)
      .map((e) => diagram.nodes[(e as { id?: string }).id ?? ''])
    const nodeRects = Object.values(diagram.elements)
      .filter((e) => e.type === ElementType.ClassNode)
      .map((e) => ({ id: e.sourceId, bounds: diagram.nodes[(e as { id?: string }).id ?? '']?.bounds }))

    const clusterRects = Object.values(diagram.elements)
      .filter((e) => e.type === ElementType.Cluster)
      .map((e) => diagram.nodes[(e as { id?: string }).id ?? '']?.bounds)
      .filter((b): b is Rect => !!b)

    for (const route of routes) {
      if (!route.labelBox) continue
      const link = diagram.elements[route.edgeId]
      const offset = link?.axonizeRouteLabelOffset
      const box: Rect = offset
        ? { ...route.labelBox, x: route.labelBox.x + offset.x, y: route.labelBox.y + offset.y }
        : route.labelBox
      const src = diagram.elements[diagram.elements[link!.port1!]!.nodeId!]?.sourceId
      const tgt = diagram.elements[diagram.elements[link!.port2!]!.nodeId!]?.sourceId
      for (const cluster of clusterRects) {
        expect(overlaps(box, cluster), `label ${src}->${tgt} overlaps a cluster`).toBe(false)
      }
      for (const node of nodeRects) {
        if (node.id === src || node.id === tgt || !node.bounds) continue
        expect(overlaps(box, node.bounds), `label ${src}->${tgt} overlaps node ${node.id}`).toBe(false)
      }
    }
    void clusters
  })
})
