import { describe, expect, it } from 'vitest'
import { defaultLightTheme, layoutFor, routeEdges } from '@benkalegin/doodles-api'
import { importMermaidFlowchartWithAxonizeLayout } from '../../../src/renderer/lib/doodles-render'

// Regression for the user's IDM/RAG/OpenSearch architecture diagram.
//
// Defect: `makeRoomForClusterCrossingLabels` → `shiftGroupsAndLaterRanks` passed
// a *live* reference to an element's bounds as the shift threshold. The loop
// mutates `bounds.x` in place, so once it reached the threshold element itself
// the comparison value changed mid-iteration. Members of the "IDM — source of
// truth" subgraph were shifted while the enclosing cluster rectangle was left
// behind, so the cluster box no longer contained its nodes — the "IDM group
// nodes are overlapping" the box border that the user reported.
const SOURCE = `flowchart LR
    RA["GenAI Assistant<br/>ResearchAgent<br/>(180 s worker ceiling)"]
    MCP["MCP server<br/>async / v2<br/>(boundary — or moved into Gen3S)"]

    subgraph GEN3S["Gen3S · inforsearchvs — owns indexing + retrieval"]
        AGENT["RAG retrieval<br/>agent loop + tools"]
        INGEST["RAG ingestion<br/>Docling · chunk · embed"]
    end

    subgraph IDMBOX["IDM — source of truth"]
        IDMACL["ACL / criteria / doctype resolve"]
        IDMPUB["Kinesis producer<br/>+ add raw S3 URI"]
        RAW[("raw document S3")]
    end

    OS[("OpenSearch clusters<br/>vector + BM25 (+ n-gram)")]
    KIN[("existing Kinesis stream<br/>+ raw S3 URI, mimeType, hash")]
    TASK[("task state + progress event log<br/>durable · seq-numbered")]

    RA -->|"sync tools/call — OK for now<br/>(fits 180 s; SSE/async later, GenAI-owned)"| MCP
    MCP ==>|"ASYNC — submit + poll/subscribe<br/>no long-held connection → avoids ELB idle timeout"| AGENT
    AGENT -->|"append progress events"| TASK
    TASK -.->|"read progress<br/>(v1: logs/metrics · later: MCP progress notifications)"| MCP
    MCP -.->|"progress to user — wired later"| RA
    AGENT -->|"resolve ACLs + filters"| IDMACL
    AGENT --> OS
    IDMPUB -->|"publishes doc-change events"| KIN
    KIN --> INGEST
    RAW -->|"fetch raw file"| INGEST
    INGEST --> OS`

interface Rect { x: number; y: number; width: number; height: number }
type Struct = {
  elements: Record<string, { id: string; type: number; sourceId?: string; text?: string; memberNodeIds?: string[]; port1?: string; port2?: string; nodeId?: string }>
  nodes: Record<string, { bounds?: Rect }>
}

const CLUSTER_LABEL = 'IDM — source of truth'
const CLUSTER_MEMBERS = [
  'ACL / criteria / doctype resolve',
  'Kinesis producer',
  'raw document S3',
]

describe('Doodles IDM/RAG/OpenSearch architecture layout', () => {
  it('keeps every IDM — source of truth node inside the cluster rectangle', async () => {
    const diagram = await importMermaidFlowchartWithAxonizeLayout(SOURCE)
    layoutFor(diagram as never)
      .cluster(CLUSTER_LABEL)
      .contains(...CLUSTER_MEMBERS)
  })

  it('does not route any edge through a non-endpoint node', async () => {
    const diagram = await importMermaidFlowchartWithAxonizeLayout(SOURCE)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    layoutFor(diagram as never, { routes }).edges().noNodeIntersection()
  })

  it('does not cross the two OpenSearch input edges against each other', async () => {
    const diagram = (await importMermaidFlowchartWithAxonizeLayout(SOURCE)) as unknown as Struct
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const osNodeId = Object.values(diagram.elements).find((e) => e.sourceId === 'OS')!.id
    const osInputs = routes.filter((r) => r.targetNodeId === osNodeId)
    expect(osInputs.length).toBe(2)

    const segmentsCross = (a: { x: number; y: number }[], b: { x: number; y: number }[]) => {
      const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
        (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
      for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
        const d1 = cross(b[j - 1]!, b[j]!, a[i - 1]!); const d2 = cross(b[j - 1]!, b[j]!, a[i]!)
        const d3 = cross(a[i - 1]!, a[i]!, b[j - 1]!); const d4 = cross(a[i - 1]!, a[i]!, b[j]!)
        if (d1 * d2 < 0 && d3 * d4 < 0) return true
      }
      return false
    }
    expect(segmentsCross(osInputs[0]!.polyline, osInputs[1]!.polyline)).toBe(false)
  })

  it('enters RAG ingestion perpendicular to its face (no arrow grazing the border)', async () => {
    const diagram = (await importMermaidFlowchartWithAxonizeLayout(SOURCE)) as unknown as Struct & {
      elements: Record<string, { id: string; sourceId?: string; axonizeRoutePolyline?: { x: number; y: number }[] }>
    }
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const ingestNode = Object.values(diagram.elements).find((e) => e.sourceId === 'INGEST')!
    const ingestId = ingestNode.id
    const ingestBounds = diagram.nodes[ingestId]!.bounds!
    const incoming = routes.filter((r) => r.targetNodeId === ingestId)
    expect(incoming.length).toBe(2)

    const AXIS_TOLERANCE_PX = 0.5
    for (const route of incoming) {
      // The renderer draws the Axonize-repaired polyline when present, so assert
      // on the effective route that actually reaches the canvas.
      const polyline = diagram.elements[route.edgeId]?.axonizeRoutePolyline ?? route.polyline
      const last = polyline[polyline.length - 1]!
      const prev = polyline[polyline.length - 2]!
      const attachesLeft = Math.abs(last.x - ingestBounds.x) < AXIS_TOLERANCE_PX
      const attachesRight = Math.abs(last.x - (ingestBounds.x + ingestBounds.width)) < AXIS_TOLERANCE_PX
      // Both back-edges attach to a vertical face, so the final approach segment
      // must be horizontal (perpendicular). A vertical final segment means the
      // arrow runs along the node border pointing up/down instead of entering —
      // the defect the user reported.
      expect(attachesLeft || attachesRight, 'incoming edge should attach to a vertical face').toBe(true)
      expect(
        Math.abs(prev.y - last.y) < AXIS_TOLERANCE_PX,
        `incoming edge final segment must be perpendicular (horizontal), got ${JSON.stringify(prev)}->${JSON.stringify(last)}`
      ).toBe(true)
    }
  })
})
