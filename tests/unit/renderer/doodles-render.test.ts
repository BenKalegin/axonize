import { describe, expect, it } from 'vitest'
import {
  canRenderWithDoodles,
  importMermaidFlowchartWithAxonizeLayout,
  renderMermaidWithDoodles,
} from '../../../src/renderer/lib/doodles-render'
import {
  defaultLightTheme,
  ElementType,
  layoutFor,
  PortAlignment,
  routeEdges,
} from '@benkalegin/doodles-api'

describe('doodles render', () => {
  it('claims sequence diagrams for the doodles path', () => {
    expect(canRenderWithDoodles('sequenceDiagram\nAlice->>Bob: Hi')).toBe(true)
  })

  it('renders a sequence diagram with lifelines and a message arrow', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Alice->>Bob: Hello Bob
Bob-->>Alice: Hi back
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Alice')
    expect(svg).toContain('Bob')
    expect(svg).toContain('Hello Bob')
    expect(svg).toContain('Hi back')
    // Dashed return-message line is rendered with the dash array.
    expect(svg).toContain('stroke-dasharray="5 4"')
  })

  it('numbers messages when autonumber is enabled', async () => {
    const source = `
sequenceDiagram
autonumber
Alice->>Bob: First
Bob->>Alice: Second
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('>1<')
    expect(svg).toContain('>2<')
    expect(svg).toContain('<circle')
  })

  it('honors autonumber start and step', async () => {
    const source = `
sequenceDiagram
autonumber 10 5
Alice->>Bob: First
Bob->>Alice: Second
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('>10<')
    expect(svg).toContain('>15<')
  })

  it('stops numbering after autonumber off', async () => {
    const source = `
sequenceDiagram
autonumber
Alice->>Bob: Numbered
autonumber off
Bob->>Alice: Unnumbered
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('>1<')
    expect(svg).not.toContain('>2<')
  })

  it('renders notes over a participant', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Note over Alice: Watch this
Alice->>Bob: After the note
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('Watch this')
    expect(svg).toContain('After the note')
    // Sticky-note rect uses the literal soft-cream fill (no CSS vars — Electron
    // SVG fill doesn't honor them consistently).
    expect(svg).toContain('#fef8d8')
  })

  it('renders notes spanning two participants', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Note over Alice,Bob: Shared note
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('Shared note')
  })

  it('renders left-of and right-of notes', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Note left of Alice: To the left
Note right of Bob: To the right
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('To the left')
    expect(svg).toContain('To the right')
  })

  it('renders an alt frame with else section', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
alt happy path
    Alice->>Bob: ok
else error
    Alice->>Bob: oops
end
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('alt')
    expect(svg).toContain('happy path')
    expect(svg).toContain('error')
    expect(svg).toContain('ok')
    expect(svg).toContain('oops')
    // Section divider for `else` uses the dashed pattern.
    expect(svg).toContain('stroke-dasharray="6 4"')
  })

  it('renders a loop frame', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
loop every minute
    Alice->>Bob: poll
end
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('loop')
    expect(svg).toContain('every minute')
    expect(svg).toContain('poll')
  })

  it('renders nested frames', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
loop outer
    opt inner
        Alice->>Bob: hi
    end
end
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('loop')
    expect(svg).toContain('opt')
    expect(svg).toContain('outer')
    expect(svg).toContain('inner')
    expect(svg).toContain('hi')
  })

  it('renders self-messages as a U-shape polyline', async () => {
    const source = `
sequenceDiagram
participant Alice
Alice->>Alice: think
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('think')
    // Pick out the polyline whose y of the first point repeats — that's the
    // U-shape (last point should be at the same y as second-to-last in the
    // arrow head, but the body polyline is the one with 4 distinct vertices).
    const polylines = Array.from(svg.matchAll(/<polyline points="([^"]+)"/g)).map(m => m[1])
    const uShape = polylines.find(p => p.split(' ').length >= 4)
    expect(uShape).toBeDefined()
  })

  it('claims xychart-beta for the doodles path', () => {
    expect(canRenderWithDoodles('xychart-beta\n    bar [1,2,3]')).toBe(true)
    expect(canRenderWithDoodles('xychart\n    bar [1,2,3]')).toBe(true)
  })

  it('still claims a chart when an %%{init: …}%% directive precedes the diagram type', () => {
    const source = `%%{init: {"themeVariables": {"xyChart": {"plotColorPalette": "#3b82f6, #22c55e"}}}}%%
xychart-beta
    bar [1, 2, 3]`
    expect(canRenderWithDoodles(source)).toBe(true)
  })

  it('still claims a sequence diagram when preceded by an init directive', () => {
    const source = `%%{init: {"theme": "dark"}}%%
sequenceDiagram
Alice->>Bob: hi`
    expect(canRenderWithDoodles(source)).toBe(true)
  })

  it('renders an xychart-beta bar chart with title and axis labels', async () => {
    const source = `
xychart-beta
    title "Sales Data"
    x-axis [Q1, Q2, Q3, Q4]
    y-axis "Revenue" 0 --> 100
    bar [23, 45, 35, 67]
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Sales Data')
    expect(svg).toContain('Revenue')
    expect(svg).toContain('>Q1<')
    expect(svg).toContain('>Q4<')
    // Four bars, one per quarter.
    expect((svg.match(/<rect\b/g) ?? []).length).toBe(4)
  })

  it('renders mixed bar + line series in a single xychart', async () => {
    const source = `
xychart-beta
    x-axis [Jan, Feb, Mar]
    y-axis 0 --> 50
    bar [20, 30, 25]
    line [15, 28, 35]
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect((svg.match(/<rect\b/g) ?? []).length).toBe(3)
    expect((svg.match(/<path\b/g) ?? []).length).toBe(1)
  })

  it('keeps quoted bracket labels inside flowchart subgraphs', async () => {
    const source = `
flowchart LR
  subgraph SnackBox["Snack cache: pantry/{snack}/v{batch}/"]
    direction TB
    waffle["waffle_manifest.json<br/>+ syrup[],<br/>butter_uri"]
    pancake["pancake_report.json<br/>+ toppings[] with sprinkles[],<br/>(fluff score)"]
    toast["toast_index.json<br/>+ crumb_slots,<br/>jam_count"]
  end

  waffle --> pancake --> toast
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const layout = layoutFor(diagram as never, {
      routes: routeEdges(diagram as never, defaultLightTheme),
    })

    layout
      .cluster('Snack cache: pantry/{snack}/v{batch}/')
      .contains('waffle_manifest.json', 'pancake_report.json', 'toast_index.json')
    layout
      .edge({ fromText: 'waffle_manifest.json', toText: 'pancake_report.json' })
      .polylineLengthAtMost(4)
    layout
      .edge({ fromText: 'pancake_report.json', toText: 'toast_index.json' })
      .polylineLengthAtMost(4)
    layout.edges().noNodeIntersection()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('syrup[]')
    expect(svg).toContain('toppings[] with sprinkles[]')
  })

  it('preserves Mermaid hexagon nodes and routes around sibling nodes', async () => {
    const source = `
flowchart TD
    EX["ERP training examples<br/>data"]

    KB{{"ERP ontology / rules<br/>model:sem"}}
    SI(["Symbolic inference"])
    CONS["Derived constraints<br/>symbols"]

    TRAIN(["Train / fine-tune<br/>task loss + semantic loss"])
    M{{"ERP classifier / LLM adapter<br/>model:stat"}}

    EX --> TRAIN
    KB --> SI
    SI --> CONS
    CONS --> TRAIN
    TRAIN --> M
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })

    layout.edges().noNodeIntersection()

    const svg = await renderMermaidWithDoodles(source)
    expect(svg).toContain('ERP ontology / rules')
    expect(svg).toContain('ERP classifier / LLM adapter')
    expect(svg).toMatch(/<g data-node-id="KB"><polygon\b/)
    expect(svg).toMatch(/<g data-node-id="M"><polygon\b/)
    expect(svg).not.toContain('>KB<')
    expect(svg).not.toContain('>M<')
  })

  it('preserves Mermaid database and subroutine node outlines', async () => {
    const source = `
flowchart LR
    EVENT["Input event"]
    STORE[("Archive bucket<br/>oversized payloads")]
    STREAM[["Event stream<br/>configured channel<br/>from settings"]]

    EVENT --> STORE
    EVENT --> STREAM

    style STORE fill:#64748b33,stroke:#64748b
    style STREAM fill:#10b98133,stroke:#10b981
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })

    layout.edge({
      fromText: 'Input event',
      toText: 'Archive bucket\noversized payloads',
    }).polylineLengthAtMost(4)
    layout.edge({
      fromText: 'Input event',
      toText: 'Event stream\nconfigured channel\nfrom settings',
    }).polylineLengthAtMost(4)
    layout.edges().noNodeIntersection()

    const svg = await renderMermaidWithDoodles(source)
    const nodeBody = (sourceId: string): string | undefined =>
      svg.match(new RegExp(`<g data-node-id="${sourceId}">([\\s\\S]*?)</g>`))?.[1]
    const databaseBody = nodeBody('STORE')
    const subroutineBody = nodeBody('STREAM')

    expect(databaseBody).toBeDefined()
    expect(databaseBody).not.toContain('<rect')
    expect(databaseBody?.match(/<path\b/g)).toHaveLength(2)
    expect(databaseBody).toContain('stroke="#64748b"')
    expect(subroutineBody).toBeDefined()
    expect(subroutineBody).toContain('<rect')
    expect(subroutineBody?.match(/<line\b/g)).toHaveLength(2)
    expect(subroutineBody).toContain('stroke="#10b981"')
  })

  it('separates overlapping cross-cluster routes into traceable lanes', async () => {
    const source = `
flowchart TB
    subgraph WORKERS["Workers"]
        W1["Parser worker"]
        W2["Vector worker"]
        W3["Media worker"]
        W4["Audit worker"]
        W5["Sync worker"]
    end

    subgraph STORES["Stores"]
        D1["Primary records"]
        D2["Large payloads"]
        D3["Raw payloads"]
        D4["Vector records"]
        D5["Media cache"]
    end

    W1 --> D1
    W1 -->|large payload| D2
    W1 -->|raw payload| D3
    W2 -->|vector output| D4
    W3 -->|media output| D5
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const structure = diagram as typeof diagram & {
      elements: Record<string, {
        sourceId?: string
        axonizeRoutePolyline?: Array<{ x: number; y: number }>
        axonizeRouteLabelOffset?: { x: number; y: number }
      }>
    }
    const routes = routeEdges(diagram as never, defaultLightTheme).map((route) => {
      const link = structure.elements[route.edgeId]
      const offset = link?.axonizeRouteLabelOffset
      return {
        ...route,
        polyline: link?.axonizeRoutePolyline ?? route.polyline,
        labelBox: route.labelBox && offset
          ? {
              ...route.labelBox,
              x: route.labelBox.x + offset.x,
              y: route.labelBox.y + offset.y,
            }
          : route.labelBox,
      }
    })
    const relevantRoutes = routes.filter((route) =>
      ['W1', 'W2', 'W3'].includes(structure.elements[route.sourceNodeId]?.sourceId ?? '') &&
      ['D1', 'D2', 'D3', 'D4', 'D5']
        .includes(structure.elements[route.targetNodeId]?.sourceId ?? '')
    )
    const busRoutes = relevantRoutes.filter((route) => route.polyline.length === 4)
    const lanes = busRoutes.map((route) => route.polyline[1]!.y)
    const layout = layoutFor(diagram as never, { routes })

    expect(busRoutes).toHaveLength(4)
    expect(new Set(lanes).size).toBe(busRoutes.length)
    expect(relevantRoutes.filter((route) =>
      structure.elements[route.edgeId]?.axonizeRoutePolyline
    )).toHaveLength(4)
    expect(relevantRoutes.filter((route) =>
      structure.elements[route.edgeId]?.axonizeRouteLabelOffset
    )).toHaveLength(4)
    layout.edges().noCrossings().noNodeIntersection().noLabelOverlap()

    const svg = await renderMermaidWithDoodles(source)
    for (const route of busRoutes) {
      const [first, ...rest] = route.polyline
      const path = [`M ${first!.x} ${first!.y}`, ...rest.map((point) =>
        `L ${point.x} ${point.y}`
      )].join(' ')
      expect(svg).toContain(`d="${path}"`)
    }
    expect(svg.match(/<text transform="translate\(/g)).toHaveLength(4)
  })

  it('keeps long multi-source fan-in routes on interior top ports', async () => {
    const source = `
flowchart TB
    subgraph CORE["Core services — post-commit dispatch"]
        ACTIVE["ACTIVE operations<br/>create · update<br/>attach · publish"]
        CLOSED["LIFECYCLE operations<br/>remove · archive<br/>purge"]
        ROUTER{"selectTarget<br/>FAST · SAFE · ALL · NONE"}
    end

    subgraph ADMIN["Administrative and migration jobs"]
        CONTROL["SchemaModelAdmin · EntityCoordinator<br/>Provisioning · retry loop"]
        PIPELINE(["Search repository workflow<br/>app.search.workflow.ref"])
        IMPORTER["IndexIntegrationWorker<br/>SearchDocumentHandler"]
        PAGER["IndexDispatcher.fetchDocuments<br/>pages records from storage by startDate<br/>→ indexRecords → reindexRecords"]
    end

    subgraph TRANSPORT["Event stream — indexing"]
        SINGLE["SearchPublisher.sendToStream<br/>putRecord · partitionKey = id<br/>ONE record per document change"]
        BATCH["SearchPublisher.processStreamRecords<br/>putRecords · batch = configuredBatchCount, default 5<br/>bulk refresh / migration only"]
        STREAM[["Event stream<br/>PrimaryStream<br/>from workspace config StreamList"]]
        OVERFLOW[("Object index bucket<br/>oversized event payloads")]
    end

    subgraph EXTERNAL["External indexing service"]
        SEARCH["External search platform service<br/>owns the index writes"]
        INDEX[("Search engine<br/>shared index + filtered aliases<br/>workspace key")]
    end

    subgraph SIDECAR["Independent enrichment pipeline"]
        FETCH["Fetch worker<br/>loads source records"]
        PREPARE["Request preparer<br/>groups content"]
        CHUNK["Chunking service<br/>splits long text"]
        BUILD["Index builder<br/>creates vectors"]
        INGEST["Search ingest pipeline<br/>writes index documents"]
        SEARCHDB[("Dedicated search store<br/>filtered workspace aliases")]
        API["Search API<br/>lexical · vector · hybrid"]
    end

    subgraph QUEUES["Document event queues"]
        QTEXT["app.rs.contentExtraction.queue"]
        QVECTOR["app.rs.semanticExtraction.queue"]
        QMEDIA["app.rs.mediaConversion.queue"]
        QAUDIT["app.rs.auditCollection.queue"]
        QSYNC["Partner / Sync queue<br/>app.sqs.workspace.url"]
    end

    subgraph WORKERS["Consumers"]
        TEXT["TextProcessing Worker<br/>ContentHelper.extract"]
        VECTOR["Vector trigger Worker<br/>→ state workflow, 11 stages"]
        MEDIA["MediaConversion Worker"]
        AUDIT["AuditingCollection Worker"]
        SYNC["Partner / Sync<br/>event delivery"]
    end

    subgraph STORES["Stores"]
        RECORDS[("Application DB — Postgres OR MSSQL<br/>column NORMALIZEDCONTENT on the record type table<br/>Record_Main · Record_Draft_* · Record_History_* · Record_Archive_*<br/>normalised text, first 900 KB · FTS-indexed")]
        LARGE[("Object resourceContentFiles<br/>normalised text, complete · >900 KB only")]
        RAW[("Object rawResourceContentFiles<br/>RAW text, un-normalised · AI only")]
        EMBEDDINGS[("Vector store — SEPARATE Postgres + pgvector<br/>one database per workspace<br/>schema vectors: document · chunk")]
        CACHE[("Object conversions cache")]
    end

    ACTIVE --> ROUTER
    CLOSED --> ROUTER
    ROUTER -->|"active target"| SINGLE
    CONTROL --> PIPELINE --> IMPORTER --> PAGER --> BATCH
    SINGLE --> STREAM
    BATCH --> STREAM
    SINGLE -.->|"oversized"| OVERFLOW
    STREAM --> SEARCH
    OVERFLOW -.-> SEARCH
    SEARCH --> INDEX
    STREAM --> FETCH --> PREPARE --> CHUNK --> BUILD --> INGEST --> SEARCHDB --> API

    ACTIVE -->|"text extraction enabled<br/>plus eligibility rules"| QTEXT
    CLOSED -.->|"not emitted after removal"| QTEXT
    ACTIVE -->|"vector extraction enabled<br/>same-event fan-out"| QVECTOR
    CLOSED -->|"lifecycle vector event<br/>remove and archive only"| QVECTOR
    ACTIVE -->|"media conversion enabled"| QMEDIA
    ACTIVE -->|"every active mutation"| QAUDIT
    CLOSED -->|"every lifecycle mutation"| QAUDIT
    ACTIVE -->|"partner service enabled"| QSYNC
    CLOSED -->|"partner service enabled"| QSYNC

    QTEXT --> TEXT
    QVECTOR --> VECTOR
    QMEDIA --> MEDIA
    QAUDIT --> AUDIT
    QSYNC --> SYNC

    TEXT --> RECORDS
    TEXT --> LARGE
    TEXT --> RAW
    VECTOR --> EMBEDDINGS
    MEDIA --> CACHE

    RECORDS -.->|"content update emits another event"| SINGLE
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const structure = diagram as typeof diagram & {
      elements: Record<string, {
        id: string
        type: ElementType
        sourceId?: string
        nodeId?: string
        port1?: string
        port2?: string
        axonizeRoutePolyline?: Array<{ x: number; y: number }>
      }>
      nodes: Record<string, { bounds?: { x: number; y: number; width: number; height: number } }>
      ports: Record<string, { alignment?: PortAlignment; edgePosRatio?: number }>
    }
    const syncRoutes = routes.filter((route) =>
      structure.elements[route.targetNodeId]?.sourceId === 'QSYNC'
    )

    expect(syncRoutes).toHaveLength(2)
    expect(syncRoutes.some((route) =>
      structure.elements[route.edgeId]?.axonizeRoutePolyline
    )).toBe(true)
    const syncBounds = structure.nodes[syncRoutes[0]!.targetNodeId]!.bounds!
    const effectiveRoutes = routes.map((route) => ({
      ...route,
      polyline: structure.elements[route.edgeId]?.axonizeRoutePolyline ?? route.polyline,
    }))
    for (const route of syncRoutes) {
      const link = structure.elements[route.edgeId]!
      const targetPort = structure.ports[link.port2!]!
      const polyline = link.axonizeRoutePolyline ?? route.polyline
      const endpoint = polyline[polyline.length - 1]!
      expect(targetPort.alignment).toBe(PortAlignment.Top)
      expect(targetPort.edgePosRatio).toBeGreaterThan(10)
      expect(targetPort.edgePosRatio).toBeLessThan(90)
      expect(endpoint.y).toBe(syncBounds.y)
      expect(endpoint.x).toBeGreaterThan(syncBounds.x + syncBounds.width * 0.1)
      expect(endpoint.x).toBeLessThan(syncBounds.x + syncBounds.width * 0.9)
    }
    layoutFor(diagram as never, { routes: effectiveRoutes }).edges().noNodeIntersection()

    const clusterBounds = (sourceId: string) => {
      const cluster = Object.values(structure.elements).find((element) =>
        element.type === ElementType.Cluster && element.id === sourceId
      )
      return cluster ? structure.nodes[cluster.id]?.bounds : undefined
    }
    const workerBounds = clusterBounds('WORKERS')!
    const storeBounds = clusterBounds('STORES')!
    expect(storeBounds.y - workerBounds.y - workerBounds.height).toBeLessThanOrEqual(160)

    const customPolyline = syncRoutes
      .map((route) => structure.elements[route.edgeId]?.axonizeRoutePolyline)
      .find((polyline) => polyline)
    expect(Math.max(...customPolyline!.map((point) => point.x)))
      .toBeLessThan(syncBounds.x + syncBounds.width)
    expect(Math.abs(
      customPolyline![customPolyline!.length - 2]!.y -
      customPolyline![customPolyline!.length - 1]!.y
    )).toBeGreaterThan(syncBounds.height)
    const [firstPoint, ...remainingPoints] = customPolyline!
    const customPath = [`M ${firstPoint!.x} ${firstPoint!.y}`, ...remainingPoints.map((point) =>
      `L ${point.x} ${point.y}`
    )].join(' ')
    const svg = await renderMermaidWithDoodles(source)
    expect(svg).toContain(`d="${customPath}"`)
  })

  it('aligns external LR targets with cluster rows and separates route buses', async () => {
    const source = `
flowchart LR
    subgraph NOTES["Lessons"]
        N1["Transport details<br/>native format batching"]
        N2["Soft limits ignored<br/>requires hard stops"]
        N3["Prompt hints backfire<br/>measured outcomes win"]
        N4["Retrieval has a ceiling<br/>surface quality matters"]
        N5["Ranking needs width<br/>tight selection loses context"]
    end

    R1["Release A: Native operations"]
    R2["Release B: Guarded data"]

    N1 --> R2
    N2 --> R1
    N3 --> R2
    N4 --> R2
    N5 --> R1
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const structure = diagram as typeof diagram & {
      elements: Record<string, {
        sourceId?: string
        axonizeRoutePolyline?: Array<{ x: number; y: number }>
      }>
      nodes: Record<string, { bounds?: { x: number; y: number; width: number; height: number } }>
    }
    const nodeBounds = (sourceId: string) => {
      const element = Object.values(structure.elements).find((item) => item.sourceId === sourceId)!
      return structure.nodes[element.id]!.bounds!
    }
    const centerY = (bounds: { y: number; height: number }) => bounds.y + bounds.height / 2
    const sourceRows = ['N1', 'N2'].map((id) => nodeBounds(id)).sort((left, right) =>
      left.y - right.y
    )
    const targetRows = ['R1', 'R2'].map((id) => nodeBounds(id)).sort((left, right) =>
      left.y - right.y
    )

    expect(centerY(targetRows[0]!)).toBeCloseTo(centerY(sourceRows[0]!), 5)
    expect(centerY(targetRows[1]!)).toBeCloseTo(centerY(sourceRows[1]!), 5)

    const routes = routeEdges(diagram as never, defaultLightTheme).map((route) => ({
      ...route,
      polyline: structure.elements[route.edgeId]?.axonizeRoutePolyline ?? route.polyline,
    }))
    const busRoutes = routes.filter((route) => route.polyline.length === 4)
    const verticalLanes = busRoutes.map((route) => route.polyline[1]!.x)
    expect(new Set(verticalLanes).size).toBe(busRoutes.length)
    layoutFor(diagram as never, { routes }).edges().noNodeIntersection()
  })

  it('keeps a long ontology branch clear of an aligned intermediate node border', async () => {
    const source = `
flowchart TD
    D["Support document<br/>data:text"]
    LLM{{"LLM<br/>model:stat"}}
    LINF(["LLM inference<br/>extract candidate relations"])
    C["Candidate JSON<br/>data"]
    VAL(["Schema + ontology validation<br/>transform"])
    S["Typed symbols<br/>REQUIRES / BLOCKS / Status"]
    KB{{"ERP ontology + rules<br/>model:sem"}}
    R(["Symbolic inference"])
    K["Derived symbolic knowledge"]

    D --> LINF
    LLM --> LINF
    LINF --> C
    C --> VAL
    KB --> VAL
    VAL --> S
    S --> R
    KB --> R
    R --> K
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })

    layout.edges().noNodeIntersection()
    layout.edges().noSameSourceCrossings()
    layout.edge({
      fromText: 'ERP ontology + rules',
      toText: 'Schema + ontology validation',
    }).hasTargetAlignment(PortAlignment.Right)
    layout.edge({
      fromText: 'ERP ontology + rules',
      toText: 'Symbolic inference',
    }).hasTargetAlignment(PortAlignment.Right)

    const structure = diagram as typeof diagram & {
      elements: Record<string, {
        sourceId?: string
        nodeId?: string
        port1?: string
        port2?: string
      }>
      ports: Record<string, { edgePosRatio?: number }>
    }
    const validationLink = Object.values(structure.elements).find((element) => {
      if (!element.port1 || !element.port2) return false
      const sourcePort = structure.elements[element.port1]
      const targetPort = structure.elements[element.port2]
      return structure.elements[sourcePort?.nodeId ?? '']?.sourceId === 'KB' &&
        structure.elements[targetPort?.nodeId ?? '']?.sourceId === 'VAL'
    })
    expect(validationLink?.port2).toBeDefined()
    expect(structure.ports[validationLink!.port2!]?.edgePosRatio).toBe(50)
  })

  it('separates parallel LR branches and keeps labeled cycle edges clear', async () => {
    const source = `
graph LR
    C["Client"]
    GP["GridPackage"]
    DB[("Database\\nmetadata query")]
    SS["Search Service\\nfull-text"]
    MR{{"Merge Results"}}

    C -->|"POST /api/items/search"| GP
    GP --> DB & SS
    DB & SS --> MR
    MR -->|results| C
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })

    layout.nodes(
      'Client',
      'GridPackage',
      'Database\nmetadata query',
      'Search Service\nfull-text',
      'Merge Results'
    ).noOverlap()
    layout.edges().noNodeIntersection()
    layout.edge({
      fromText: 'Merge Results',
      toText: 'Client',
    })
      .hasSourceAlignment(PortAlignment.Bottom)
      .hasTargetAlignment(PortAlignment.Bottom)

    const structure = diagram as typeof diagram & {
      elements: Record<string, {
        id: string
        type: ElementType
        sourceId?: string
        nodeId?: string
        port1?: string
        port2?: string
      }>
      nodes: Record<string, { bounds?: { x: number; y: number; width: number; height: number } }>
      ports: Record<string, { edgePosRatio?: number }>
    }
    const nodeBounds = Object.values(structure.elements)
      .filter((element) => element.type === ElementType.ClassNode)
      .map((element) => structure.nodes[element.id]?.bounds)
      .filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== undefined)

    for (const route of routes) {
      if (!route.labelBox) continue
      for (const bounds of nodeBounds) {
        const overlaps = route.labelBox.x < bounds.x + bounds.width &&
          bounds.x < route.labelBox.x + route.labelBox.width &&
          route.labelBox.y < bounds.y + bounds.height &&
          bounds.y < route.labelBox.y + route.labelBox.height
        expect(overlaps, `label "${route.label}" overlaps a node`).toBe(false)
      }
    }

    const targetRatio = (sourceId: string, targetId: string): number | undefined => {
      const link = Object.values(structure.elements).find((element) => {
        if (!element.port1 || !element.port2) return false
        const sourcePort = structure.elements[element.port1]
        const targetPort = structure.elements[element.port2]
        return structure.elements[sourcePort?.nodeId ?? '']?.sourceId === sourceId &&
          structure.elements[targetPort?.nodeId ?? '']?.sourceId === targetId
      })
      return link?.port2 ? structure.ports[link.port2]?.edgePosRatio : undefined
    }
    expect(targetRatio('DB', 'MR')).toBe(25)
    expect(targetRatio('SS', 'MR')).toBe(75)

    const incomingRoute = (sourceId: string, targetId: string) => routes.find((route) =>
      structure.elements[route.sourceNodeId]?.sourceId === sourceId &&
      structure.elements[route.targetNodeId]?.sourceId === targetId
    )
    const databaseRoute = incomingRoute('DB', 'MR')!
    const searchRoute = incomingRoute('SS', 'MR')!
    const databaseTargetY = databaseRoute.polyline[databaseRoute.polyline.length - 1]!.y
    const searchSourceY = searchRoute.polyline[0]!.y
    expect(Math.abs(searchSourceY - databaseTargetY)).toBeGreaterThanOrEqual(15)

    const svg = await renderMermaidWithDoodles(source)
    expect(svg).toContain('POST /api/items/search')
    expect(svg).toContain('results')
  })

  it('keeps a terminal LR sink at the end of its main chain', async () => {
    const source = `
graph LR
    DC["Document Change"]
    K["Kinesis Stream"]
    SIL["SearchIntegrationLambda"]
    Proc["Process Document"]
    Meta["Extract Metadata"]
    SI["Search Index"]
    DB[("Database")]

    DC --> K --> SIL --> Proc --> Meta --> SI
    SIL -->|update index status| DB
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })

    layout.nodes(
      'Document Change',
      'Kinesis Stream',
      'SearchIntegrationLambda',
      'Process Document',
      'Extract Metadata',
      'Search Index'
    )
      .orderedLeftToRight()
      .sameRow()
    layout.node('Database').below('SearchIntegrationLambda')
    layout.edge({
      fromText: 'Extract Metadata',
      toText: 'Search Index',
    }).polylineLengthAtMost(2)
    layout.edges().noNodeIntersection()

    const svg = await renderMermaidWithDoodles(source)
    expect(svg).toContain('Search Index')
    expect(svg).toContain('update index status')
  })

  it('removes an unnecessary dogleg from an aligned single-input target', async () => {
    const source = `
%%{init: {'flowchart':{'curve':'basis','htmlLabels':true}}}%%
flowchart LR
    subgraph Sources["Event sources — emitted after the primary transaction commits"]
        CREATE["createRecord<br/>~120"]
        UPDATE["updateRecord<br/>~240"]
        ATTACH["attachPayload<br/>~360"]
        BULK["bulkChanges<br/>buffers, flushes post-commit<br/>~480 to 540"]
        SPECIAL["ConversionPipeline<br/>OptionalCheckEnabled<br/>~660 to 720"]
        MIGRATE["Platform migration / reindex<br/>enqueueBackfillJob"]
    end

    FILTER{"dispatchProcessingJob<br/>5 eligibility rules<br/>see policy"}
    TOGGLE{"ENABLE_SECONDARY_PROCESSING<br/>per workspace"}
    PRIMARY["Queue<br/>app.processing.primary<br/>Primary worker"]
    SECONDARY["Queue<br/>app.processing.secondary<br/>delivery channel<br/>Secondary worker"]

    CREATE --> FILTER
    UPDATE --> FILTER
    ATTACH --> FILTER
    BULK --> FILTER
    SPECIAL --> FILTER
    MIGRATE --> FILTER
    FILTER -->|passes| PRIMARY
    FILTER --> TOGGLE
    TOGGLE -->|on| SECONDARY
    TOGGLE -->|off| DROP["no secondary message"]

    style Sources fill:#6366f11A,stroke:#6366f1
    style CREATE fill:#6366f133,stroke:#6366f1
    style UPDATE fill:#6366f133,stroke:#6366f1
    style ATTACH fill:#6366f133,stroke:#6366f1
    style BULK fill:#6366f133,stroke:#6366f1
    style SPECIAL fill:#10b98133,stroke:#10b981
    style MIGRATE fill:#64748b33,stroke:#64748b
    style FILTER fill:#f59e0b40,stroke:#f59e0b
    style TOGGLE fill:#f59e0b40,stroke:#f59e0b
    style SECONDARY fill:#10b98133,stroke:#10b981
    style PRIMARY fill:#64748b33,stroke:#64748b
    style DROP fill:#ef444433,stroke:#ef4444
`.trim()

    const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const layout = layoutFor(diagram as never, { routes })

    layout.edge({
      fromText: 'ENABLE_SECONDARY_PROCESSING\nper workspace',
      toText: 'Queue\napp.processing.secondary\ndelivery channel\nSecondary worker',
    }).polylineLengthAtMost(2)
    layout.edges().noNodeIntersection()

    const structure = diagram as typeof diagram & {
      elements: Record<string, {
        sourceId?: string
        nodeId?: string
        port1?: string
        port2?: string
      }>
      ports: Record<string, { edgePosRatio?: number }>
    }
    const onLink = Object.values(structure.elements).find((element) => {
      if (!element.port1 || !element.port2) return false
      const sourcePort = structure.elements[element.port1]
      const targetPort = structure.elements[element.port2]
      return structure.elements[sourcePort?.nodeId ?? '']?.sourceId === 'TOGGLE' &&
        structure.elements[targetPort?.nodeId ?? '']?.sourceId === 'SECONDARY'
    })
    expect(onLink?.port2).toBeDefined()
    expect(structure.ports[onLink!.port2!]?.edgePosRatio).toBeCloseTo(84.66, 1)
  })

  it('renders class diagram members in doodles mode', async () => {
    const source = `
classDiagram
direction LR
class User {
  +string id
  +placeOrder()
}
class Order {
  +string id
  +decimal total
  +submit()
}
User --> Order : places
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('User')
    expect(svg).toContain('+string id')
    expect(svg).toContain('+placeOrder()')
    expect(svg).toContain('+decimal total')
    expect(svg).toContain('+submit()')
    expect(svg).toContain('marker-end="url(#doodles-arrow)"')
  })
})
