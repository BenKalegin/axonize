import { describe, expect, it } from 'vitest'
import {
  canRenderWithDoodles,
  importMermaidFlowchartWithAxonizeLayout,
  renderMermaidWithDoodles,
} from '../../../src/renderer/lib/doodles-render'
import { defaultLightTheme, layoutFor, PortAlignment, routeEdges } from '@benkalegin/doodles-api'

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
