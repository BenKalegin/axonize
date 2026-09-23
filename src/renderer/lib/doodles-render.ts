import {
  type Diagram,
  ElementType,
  defaultDiagramDisplay,
  importMermaidStructureDiagram,
  importMermaidFlowchartWithLayout,
  importMermaidSequenceWithLayout,
  importMermaidXyChartDiagram,
  renderChartSvg,
  renderSequenceSvg,
  renderSvg,
  routeEdges,
  inflate,
  PortAlignment,
  segmentEntersRect,
  type EdgeRoute,
  type ThemeTokens,
  defaultLightTheme,
  defaultDarkTheme,
  LayoutDirection,
  parseMermaidLayoutHints,
} from '@benkalegin/doodles-api'
import { getActiveTheme } from '@/lib/theme-applier'
import {
  classNodeHeaderTextInsets,
  classNodeMemberFontSize,
  classNodeMemberLineHeight,
  classNodeMemberTextInsets,
  classNodeSectionsLayout,
} from '@benkalegin/doodles-core'

// `(?:%%[^\n]*\n\s*)*` skips zero or more leading mermaid directive/comment
// lines (`%%{init: …}%%`, `%% comment`) between any frontmatter and the
// diagram type. Without this, an `%%{init: …}%%` line in a chart source
// causes canRenderWithDoodles to return false and the renderer dropdown
// becomes a no-op.
const DIAGRAM_TYPE_RE = /^\s*(?:---\s*\n[\s\S]*?\n---\s*\n)?(?:%%[^\n]*\n\s*)*(flowchart|graph|classDiagram|c4context|c4container|c4component|c4dynamic|c4deployment|sequenceDiagram|xychart(?:-beta)?)\b/i

const DiagramType = {
  Class: 'class',
  Sequence: 'sequence',
  XyChart: 'xychart',
  Flowchart: 'flowchart',
} as const
type DiagramType = (typeof DiagramType)[keyof typeof DiagramType]

// Maps the lowercased token captured by DIAGRAM_TYPE_RE to its semantic type.
// Both `xychart` and `xychart-beta` map to XyChart; everything else is exact.
const TOKEN_TO_DIAGRAM_TYPE: Record<string, DiagramType> = {
  flowchart: DiagramType.Flowchart,
  graph: DiagramType.Flowchart,
  classdiagram: DiagramType.Class,
  sequencediagram: DiagramType.Sequence,
  xychart: DiagramType.XyChart,
  'xychart-beta': DiagramType.XyChart,
  c4context: DiagramType.Flowchart,
  c4container: DiagramType.Flowchart,
  c4component: DiagramType.Flowchart,
  c4dynamic: DiagramType.Flowchart,
  c4deployment: DiagramType.Flowchart,
}

function detectDiagramType(source: string): DiagramType | undefined {
  const match = DIAGRAM_TYPE_RE.exec(source)
  if (!match) return undefined
  return TOKEN_TO_DIAGRAM_TYPE[match[1]!.toLowerCase()]
}

const SVG_PADDING = 24
const MIN_VIEWBOX_WIDTH = 1
const MIN_VIEWBOX_HEIGHT = 1

const NODE_CORNER_RADIUS = 4
const NODE_STROKE_WIDTH = 1.5
const NODE_NEUTRAL_FILL_OPACITY = 0.06

const CLASS_SECTION_DIVIDER_STROKE_WIDTH = 1
const CLASS_SECTION_TEXT_WEIGHT = 'normal'

const CLUSTER_CORNER_RADIUS = 6
const CLUSTER_LABEL_HEIGHT = 22
const CLUSTER_NEUTRAL_FILL_OPACITY = 0.04
const CLUSTER_HEADER_NEUTRAL_FILL_OPACITY = 0.08

const EDGE_STROKE_WIDTH = 1.5
const EDGE_LABEL_FONT_SIZE = 14
const EDGE_LABEL_HALO_STROKE_WIDTH = 4
const EDGE_LABEL_VERTICAL_OFFSET = 4

const WHITE_SPACE_RE = /\s+/g
const MERMAID_QUOTED_LABEL_RIGHT_BRACKET_PLACEHOLDER = '\uE000'
const AxonizeFlowchartShape = {
  Hexagon: 'hexagon',
  Database: 'database',
  Subroutine: 'subroutine',
} as const
type AxonizeFlowchartShape =
  (typeof AxonizeFlowchartShape)[keyof typeof AxonizeFlowchartShape]
const ROUTE_OBSTACLE_CLEARANCE_PX = 8
const PORT_RATIO_STEP = 5
const SAME_RANK_TOLERANCE_PX = 1
const OVERLAPPING_NODE_GAP_PX = 60
const EDGE_LABEL_NODE_CLEARANCE_PX = 16
const DISPLAY_BOUNDS_MARGIN_PX = 48
const TERMINAL_NODE_RANK_GAP_PX = 80
const CENTER_PORT_RATIO_PERCENT = 50
const FAN_OUT_PORT_SPAN_PERCENT = 100
const STRAIGHT_ROUTE_PORT_MARGIN_PERCENT = 10
const BUS_ROUTE_LANE_GAP_PX = 20
const BUS_ROUTE_MIN_LANE_GAP_PX = 8
const BUS_ROUTE_CLUSTER_CLEARANCE_PX = 20
const COMPACT_CLUSTER_GAP_PX = 80
const COMPACT_CLUSTER_THRESHOLD_PX = 160

type DiagramDisplay = {
  width: number
  height: number
}

type DiagramBounds = {
  x: number
  y: number
  width: number
  height: number
}

type DiagramColorSchema = {
  fillColor?: string
  strokeColor?: string
  textColor?: string
}

type DiagramClassMember = {
  kind: 'field' | 'method'
  text: string
}

type DiagramElement = {
  id: string
  type: ElementType
  text?: string
  sourceId?: string
  classAnnotation?: string
  classMembers?: DiagramClassMember[]
  colorSchema?: DiagramColorSchema
  axonizeFlowchartShape?: AxonizeFlowchartShape
  port1?: string
  port2?: string
  nodeId?: string
  memberNodeIds?: string[]
  axonizeRoutePolyline?: EdgeRoute['polyline']
  axonizeRouteLabelOffset?: { x: number; y: number }
}

type DiagramNodeRecord = {
  bounds: DiagramBounds
}

type DiagramNodeEntry = {
  element: DiagramElement
  bounds: DiagramBounds
}

type DiagramPortRecord = {
  alignment?: PortAlignment
  edgePosRatio?: number
}

type FlowPortAlignments = {
  source: PortAlignment
  target: PortAlignment
}

const FLOW_PORT_ALIGNMENTS: Readonly<Record<string, FlowPortAlignments>> = {
  [LayoutDirection.LeftToRight]: { source: PortAlignment.Right, target: PortAlignment.Left },
  [LayoutDirection.RightToLeft]: { source: PortAlignment.Left, target: PortAlignment.Right },
  [LayoutDirection.TopToBottom]: { source: PortAlignment.Bottom, target: PortAlignment.Top },
  [LayoutDirection.BottomToTop]: { source: PortAlignment.Top, target: PortAlignment.Bottom },
}

type StructureDiagram = Diagram & {
  display: DiagramDisplay
  elements: Record<string, DiagramElement>
  nodes: Record<string, DiagramNodeRecord>
  ports?: Record<string, DiagramPortRecord>
}

/**
 * True for Mermaid sources doodles knows how to parse + render end-to-end:
 * flowchart / graph / classDiagram / C4 variants / sequenceDiagram / xychart.
 * Other kinds (gantt, er, pie, state, mindmap, …) still go through the
 * `mermaid` library.
 */
export function canRenderWithDoodles(source: string): boolean {
  return detectDiagramType(source) !== undefined
}

/**
 * Parse + layout + render a Mermaid source as SVG via `@benkalegin/doodles-api`.
 * Returns the SVG string. Throws if the source is malformed or doodles' importer
 * rejects it — the caller falls back to the mermaid library on throw.
 */
export async function renderMermaidWithDoodles(
  source: string,
  options: { dark?: boolean } = {}
): Promise<string> {
  const theme: ThemeTokens = options.dark ? defaultDarkTheme : defaultLightTheme
  switch (detectDiagramType(source)) {
    case DiagramType.XyChart:
      return renderXyChartWithDoodles(source, theme)
    case DiagramType.Sequence:
      return renderSequenceDiagramWithDoodles(source, theme)
    case DiagramType.Class:
      return renderClassDiagramWithDoodles(source, theme)
    default:
      return renderFlowchartWithDoodles(source, theme)
  }
}

async function renderFlowchartWithDoodles(source: string, theme: ThemeTokens): Promise<string> {
  const diagram = await importMermaidFlowchartWithAxonizeLayout(source)
  const svg = renderSvg(diagram as never, { theme })
  const withShapes = patchUnsupportedFlowchartShapes(svg, diagram as StructureDiagram)
  const withRoutes = patchFlowchartEdgeRoutes(withShapes, diagram as StructureDiagram)
  return fitFlowchartSvgToContent(withRoutes, diagram as StructureDiagram)
}

function flowchartContentBounds(diagram: StructureDiagram): DiagramBounds | undefined {
  const boxes = Object.values(diagram.elements)
    .filter((element) => element.type === ElementType.ClassNode || element.type === ElementType.Cluster)
    .map((element) => diagram.nodes[element.id]?.bounds)
    .filter((bounds): bounds is DiagramBounds => isValidBounds(bounds))
  const points = boxes.flatMap((bounds) => [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  ])
  for (const route of effectiveRouteEdges(diagram)) {
    points.push(...route.polyline)
    if (route.labelBox) {
      const { x, y, width, height } = route.labelBox
      points.push({ x, y }, { x: x + width, y: y + height })
    }
  }
  if (points.length === 0) return undefined
  const x = Math.min(...points.map((point) => point.x)) - SVG_PADDING
  const y = Math.min(...points.map((point) => point.y)) - SVG_PADDING
  const right = Math.max(...points.map((point) => point.x)) + SVG_PADDING
  const bottom = Math.max(...points.map((point) => point.y)) + SVG_PADDING
  return { x, y, width: right - x, height: bottom - y }
}

// Inline diagrams occupy their painted content, not the editor's canvas size.
// Measure after route repair so outer loops and relocated labels remain visible.
function fitFlowchartSvgToContent(svg: string, diagram: StructureDiagram): string {
  const bounds = flowchartContentBounds(diagram)
  if (!bounds) return svg
  return svg.replace(/^<svg\b[^>]*>/, (root) => root
    .replace(/\bviewBox="[^"]*"/, `viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"`)
    .replace(/\bwidth="[^"]*"/, `width="${bounds.width}"`)
    .replace(/\bheight="[^"]*"/, `height="${bounds.height}"`))
}

export async function importMermaidFlowchartWithAxonizeLayout(source: string): Promise<Diagram> {
  const base: Diagram = {
    id: 'ax-doodle',
    type: ElementType.FlowchartDiagram,
    display: defaultDiagramDisplay,
  }
  const { source: compatibleSource, nodeShapes } = replaceUnsupportedFlowchartNodes(source)
  const protectedSource = protectQuotedLabelClosingBrackets(compatibleSource)
  const diagram = (await importMermaidFlowchartWithLayout(base, protectedSource)) as StructureDiagram
  const direction = parseMermaidLayoutHints(protectedSource).direction
  restoreQuotedLabelClosingBrackets(diagram)
  markUnsupportedFlowchartNodes(diagram, nodeShapes)
  repairFlowchartGeometry(diagram, direction)
  avoidNodeCrossingRoutes(diagram)
  avoidSameSourceRouteCrossings(diagram)
  avoidSameTargetRouteCrossings(diagram)
  straightenSingleIncomingRoutes(diagram)
  expandDisplayToFitNodes(diagram)
  separateOverlappingRouteBuses(diagram, direction)
  repairTopBottomFanInCornerAttachments(diagram, direction)
  return diagram
}

/**
 * Doodles currently maps database nodes to terminator pills and does not have
 * native hexagon or subroutine node kinds. Feed its importer equivalent process
 * wrappers so labels and topology survive, while recording the Mermaid source
 * ids whose correct outlines must be restored after SVG rendering.
 */
function replaceUnsupportedFlowchartNodes(source: string): {
  source: string
  nodeShapes: Map<string, AxonizeFlowchartShape>
} {
  const nodeShapes = new Map<string, AxonizeFlowchartShape>()
  const lines = source.split('\n').map((line) => {
    if (line.trimStart().startsWith('%%')) return line
    return replaceUnsupportedFlowchartNodesInLine(line, nodeShapes)
  })
  return { source: lines.join('\n'), nodeShapes }
}

type UnsupportedFlowchartShapeSpec = {
  shape: AxonizeFlowchartShape
  innerOpen: string
  innerClose: string
  close: string
}

const UNSUPPORTED_FLOWCHART_SHAPE_SPECS: Record<string, UnsupportedFlowchartShapeSpec> = {
  '{{': {
    shape: AxonizeFlowchartShape.Hexagon,
    innerOpen: '{',
    innerClose: '}',
    close: '}}',
  },
  '[(': {
    shape: AxonizeFlowchartShape.Database,
    innerOpen: '(',
    innerClose: ')',
    close: ')]',
  },
  '[[': {
    shape: AxonizeFlowchartShape.Subroutine,
    innerOpen: '[',
    innerClose: ']',
    close: ']]',
  },
}

function replaceUnsupportedFlowchartNodesInLine(
  line: string,
  nodeShapes: Map<string, AxonizeFlowchartShape>
): string {
  const startRe = /(^|[^\w-])([\w-]+)(\s*)(\{\{|\[\(|\[\[)/g
  let result = ''
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = startRe.exec(line)) !== null) {
    const spec = UNSUPPORTED_FLOWCHART_SHAPE_SPECS[match[4]!]
    if (!spec) continue
    const contentStart = startRe.lastIndex
    const contentEnd = findUnsupportedFlowchartShapeClose(line, contentStart, spec)
    if (contentEnd < 0) break

    const prefixLength = match[1]!.length
    const nodeStart = match.index + prefixLength
    const id = match[2]!
    const spacing = match[3]!
    const label = line.slice(contentStart, contentEnd)

    result += line.slice(cursor, nodeStart)
    result += `${id}${spacing}[${label}]`
    nodeShapes.set(id, spec.shape)
    cursor = contentEnd + spec.close.length
    startRe.lastIndex = cursor
  }

  return cursor === 0 ? line : result + line.slice(cursor)
}

function findUnsupportedFlowchartShapeClose(
  line: string,
  start: number,
  spec: UnsupportedFlowchartShapeSpec
): number {
  let quote: '"' | '`' | undefined
  let escaped = false
  let depth = 1
  for (let index = start; index < line.length; index++) {
    const char = line[index]!
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = undefined
      }
      continue
    }
    if (char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === spec.innerOpen) {
      depth++
    } else if (char === spec.innerClose) {
      depth--
      if (depth === 0) {
        if (line.slice(index, index + spec.close.length) === spec.close) return index
        depth++
      }
    }
  }
  return -1
}

function markUnsupportedFlowchartNodes(
  diagram: StructureDiagram,
  nodeShapes: Map<string, AxonizeFlowchartShape>
): void {
  if (nodeShapes.size === 0) return
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.ClassNode || !element.sourceId) continue
    element.axonizeFlowchartShape = nodeShapes.get(element.sourceId)
  }
}

/**
 * Filigree can collapse parallel branch nodes onto identical coordinates, and
 * its fixed rank gap does not account for long edge labels. Repair those two
 * geometry defects before ports are obstacle-checked and routed.
 */
function repairFlowchartGeometry(
  diagram: StructureDiagram,
  direction: string | undefined
): void {
  const resolvedDirection = direction ?? LayoutDirection.TopToBottom
  repairMisplacedTerminalNodes(diagram, resolvedDirection)
  separateOverlappingRankNodes(diagram, resolvedDirection)
  centerSharedFanOutNodes(diagram, resolvedDirection)
  alignExternalTargetsWithClusterRows(diagram, resolvedDirection)
  compactSinkLikeClusterGaps(diagram, resolvedDirection)
  makeRoomForForwardEdgeLabels(diagram, resolvedDirection)
}

function classNodeEntries(diagram: StructureDiagram): DiagramNodeEntry[] {
  const entries: DiagramNodeEntry[] = []
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.ClassNode) continue
    const bounds = diagram.nodes[element.id]?.bounds
    if (!isValidBounds(bounds)) continue
    entries.push({ element, bounds })
  }
  return entries
}

function isHorizontalDirection(direction: string): boolean {
  return direction === LayoutDirection.LeftToRight ||
    direction === LayoutDirection.RightToLeft
}

// A single-parent branch point should not inherit one child's column when its
// parent already sits midway between the children. Leave compound placement
// alone, and accept a move only when it preserves node and route clearance.
function centerSharedFanOutNodes(diagram: StructureDiagram, direction: string): void {
  if (Object.values(diagram.elements).some((element) => element.type === ElementType.Cluster)) return
  const horizontal = isHorizontalDirection(direction)
  const entries = classNodeEntries(diagram)
  for (const entry of entries) {
    const routes = routeEdges(diagram as never, defaultLightTheme)
    const center = sharedFanOutCenter(diagram, entry, routes, direction)
    if (center === undefined) continue
    const original = crossStart(entry.bounds, horizontal)
    const before = flowchartRouteConflicts(diagram, routes)
    setCrossStart(entry.bounds, horizontal, center - crossSize(entry.bounds, horizontal) / 2)
    const ports = balanceForwardFanOutPorts(diagram, entry.element.id, routes, direction)
    const overlaps = entries.some((other) => other !== entry && rectanglesOverlap(entry.bounds, other.bounds))
    const after = flowchartRouteConflicts(diagram, routeEdges(diagram as never, defaultLightTheme))
    if (overlaps || after.some((count, index) => count > before[index]!)) {
      setCrossStart(entry.bounds, horizontal, original)
      for (const { port, ratio } of ports) port.edgePosRatio = ratio
    }
  }
}

function balanceForwardFanOutPorts(
  diagram: StructureDiagram,
  sourceId: string,
  routes: EdgeRoute[],
  direction: string
): Array<{ port: DiagramPortRecord; ratio: number | undefined }> {
  const horizontal = isHorizontalDirection(direction)
  const outgoing = routes.filter((route) => route.sourceNodeId === sourceId)
    .sort((left, right) => crossCenter(diagram.nodes[left.targetNodeId]!.bounds, horizontal) -
      crossCenter(diagram.nodes[right.targetNodeId]!.bounds, horizontal))
  const ports = outgoing.map((route) => {
    const portId = diagram.elements[route.edgeId]?.port1
    return portId ? diagram.ports?.[portId] : undefined
  })
  if (ports.some((port) => !port || port.alignment !== FLOW_PORT_ALIGNMENTS[direction]?.source)) return []
  return ports.map((port, index) => {
    const snapshot = { port: port!, ratio: port!.edgePosRatio }
    port!.edgePosRatio = (index + 1 / 2) * FAN_OUT_PORT_SPAN_PERCENT / ports.length
    return snapshot
  })
}

function sharedFanOutCenter(
  diagram: StructureDiagram,
  entry: DiagramNodeEntry,
  routes: EdgeRoute[],
  direction: string
): number | undefined {
  const incoming = routes.filter((route) => route.targetNodeId === entry.element.id)
  const outgoing = routes.filter((route) => route.sourceNodeId === entry.element.id)
  if (incoming.length !== 1 || outgoing.length <= 1) return undefined
  const parent = diagram.nodes[incoming[0]!.sourceNodeId]?.bounds
  const children = outgoing.map((route) => diagram.nodes[route.targetNodeId]?.bounds)
  if (!isValidBounds(parent) || children.some((bounds) => !isValidBounds(bounds))) return undefined
  if (forwardRankGap(parent, entry.bounds, direction) === undefined ||
    children.some((bounds) => forwardRankGap(entry.bounds, bounds, direction) === undefined)) return undefined
  if (outgoing.some((edge) => routes.filter((route) => route.targetNodeId === edge.targetNodeId).length !== 1)) return undefined
  const horizontal = isHorizontalDirection(direction)
  const rank = primaryStart(children[0]!, horizontal)
  if (children.some((bounds) => Math.abs(primaryStart(bounds, horizontal) - rank) > SAME_RANK_TOLERANCE_PX)) return undefined
  const centers = children.map((bounds) => crossCenter(bounds, horizontal))
  const center = (Math.min(...centers) + Math.max(...centers)) / 2
  if (Math.abs(crossCenter(parent, horizontal) - center) > SAME_RANK_TOLERANCE_PX) return undefined
  return center
}

function flowchartRouteConflicts(diagram: StructureDiagram, routes: EdgeRoute[]): number[] {
  return [
    routes.reduce((sum, route) => sum + routeNodeIntersectionCount(route, diagram), 0),
    routes.reduce((sum, route) => sum + routeLabelNodeIntersectionCount(route, diagram), 0),
    routeCrossingCount(routes),
    routeOverlapCount(routes),
    routeLabelOverlapCount(routes),
  ]
}

/**
 * A terminal sink with one predecessor cannot be a graph back-edge. If the
 * layout nevertheless places it behind that predecessor, restore the terminal
 * rank, align it with the end of the main chain, and reorient the edge ports to
 * the declared flow direction. Multi-input sinks and compound diagrams are
 * left to the layout engine because their placement has more than one valid
 * interpretation.
 */
function repairMisplacedTerminalNodes(diagram: StructureDiagram, direction: string): void {
  if (Object.values(diagram.elements).some((element) => element.type === ElementType.Cluster)) {
    return
  }

  const incoming = new Map<string, string[]>()
  const outgoingCount = new Map<string, number>()
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.ClassLink || !element.port1 || !element.port2) continue
    const sourceNodeId = diagram.elements[element.port1]?.nodeId
    const targetNodeId = diagram.elements[element.port2]?.nodeId
    if (!sourceNodeId || !targetNodeId) continue
    outgoingCount.set(sourceNodeId, (outgoingCount.get(sourceNodeId) ?? 0) + 1)
    const predecessors = incoming.get(targetNodeId) ?? []
    predecessors.push(sourceNodeId)
    incoming.set(targetNodeId, predecessors)
  }

  for (const { element, bounds } of classNodeEntries(diagram)) {
    const predecessors = incoming.get(element.id)
    if (outgoingCount.get(element.id) || predecessors?.length !== 1) continue
    const predecessorBounds = diagram.nodes[predecessors[0]!]?.bounds
    if (!isValidBounds(predecessorBounds)) continue
    if (forwardRankGap(predecessorBounds, bounds, direction) !== undefined) continue

    if (direction === LayoutDirection.LeftToRight) {
      bounds.x = predecessorBounds.x + predecessorBounds.width + TERMINAL_NODE_RANK_GAP_PX
      bounds.y = predecessorBounds.y + (predecessorBounds.height - bounds.height) / 2
    } else if (direction === LayoutDirection.RightToLeft) {
      bounds.x = predecessorBounds.x - bounds.width - TERMINAL_NODE_RANK_GAP_PX
      bounds.y = predecessorBounds.y + (predecessorBounds.height - bounds.height) / 2
    } else if (direction === LayoutDirection.TopToBottom) {
      bounds.x = predecessorBounds.x + (predecessorBounds.width - bounds.width) / 2
      bounds.y = predecessorBounds.y + predecessorBounds.height + TERMINAL_NODE_RANK_GAP_PX
    } else if (direction === LayoutDirection.BottomToTop) {
      bounds.x = predecessorBounds.x + (predecessorBounds.width - bounds.width) / 2
      bounds.y = predecessorBounds.y - bounds.height - TERMINAL_NODE_RANK_GAP_PX
    }
    alignTerminalEdgeWithFlow(diagram, predecessors[0]!, element.id, direction)
  }
}

function alignTerminalEdgeWithFlow(
  diagram: StructureDiagram,
  sourceNodeId: string,
  targetNodeId: string,
  direction: string
): void {
  if (!diagram.ports) return
  const link = Object.values(diagram.elements).find((element) => {
    if (element.type !== ElementType.ClassLink || !element.port1 || !element.port2) return false
    return diagram.elements[element.port1]?.nodeId === sourceNodeId &&
      diagram.elements[element.port2]?.nodeId === targetNodeId
  })
  if (!link?.port1 || !link.port2) return
  const sourcePort = diagram.ports[link.port1]
  const targetPort = diagram.ports[link.port2]
  const alignments = FLOW_PORT_ALIGNMENTS[direction]
  if (!sourcePort || !targetPort || !alignments) return

  sourcePort.alignment = alignments.source
  targetPort.alignment = alignments.target
  sourcePort.edgePosRatio = CENTER_PORT_RATIO_PERCENT
  targetPort.edgePosRatio = CENTER_PORT_RATIO_PERCENT
}

/**
 * Nodes in one layout rank must occupy distinct slots on the cross axis. Keep
 * the rank centered where Filigree placed it, but repack a colliding rank with
 * a readable gutter between siblings.
 */
function separateOverlappingRankNodes(diagram: StructureDiagram, direction: string): void {
  const horizontal = isHorizontalDirection(direction)
  const entries = classNodeEntries(diagram)
  const ranks: DiagramNodeEntry[][] = []

  for (const entry of entries.sort((left, right) =>
    primaryStart(left.bounds, horizontal) - primaryStart(right.bounds, horizontal)
  )) {
    const rank = ranks.find((candidate) =>
      Math.abs(
        primaryStart(candidate[0]!.bounds, horizontal) -
        primaryStart(entry.bounds, horizontal)
      ) <= SAME_RANK_TOLERANCE_PX
    )
    if (rank) rank.push(entry)
    else ranks.push([entry])
  }

  for (const rank of ranks) {
    if (rank.length < 2) continue
    rank.sort((left, right) =>
      crossStart(left.bounds, horizontal) - crossStart(right.bounds, horizontal)
    )
    const hasOverlap = rank.some((entry, index) => {
      if (index === 0) return false
      const previous = rank[index - 1]!
      return crossStart(entry.bounds, horizontal) < crossEnd(previous.bounds, horizontal)
    })
    if (!hasOverlap) continue

    const originalCenter = rank.reduce(
      (sum, entry) => sum + crossCenter(entry.bounds, horizontal),
      0
    ) / rank.length
    const packedSize = rank.reduce(
      (sum, entry) => sum + crossSize(entry.bounds, horizontal),
      OVERLAPPING_NODE_GAP_PX * (rank.length - 1)
    )
    let cursor = originalCenter - packedSize / 2
    for (const entry of rank) {
      setCrossStart(entry.bounds, horizontal, cursor)
      cursor += crossSize(entry.bounds, horizontal) + OVERLAPPING_NODE_GAP_PX
    }
  }
}

/**
 * Filigree can place unclustered LR terminal nodes one row above the cluster
 * that feeds them. Align those targets with the cluster's leading rows so they
 * read as destinations beside the list rather than as detached headings.
 */
function alignExternalTargetsWithClusterRows(
  diagram: StructureDiagram,
  direction: string
): void {
  if (direction !== LayoutDirection.LeftToRight &&
    direction !== LayoutDirection.RightToLeft) return
  const routes = routeEdges(diagram as never, defaultLightTheme)
  const outgoingNodeIds = new Set(routes.map((route) => route.sourceNodeId))
  const groups = new Map<string, DiagramNodeEntry[]>()

  for (const entry of classNodeEntries(diagram)) {
    if (outgoingNodeIds.has(entry.element.id) ||
      directClusterContainingNode(diagram, entry.element.id)) continue
    const incoming = routes.filter((route) => route.targetNodeId === entry.element.id)
    if (incoming.length === 0) continue
    const sourceClusterIds = incoming.map((route) =>
      directClusterContainingNode(diagram, route.sourceNodeId)
    )
    if (sourceClusterIds.some((id) => id === undefined) ||
      new Set(sourceClusterIds).size !== 1) continue
    const sourceClusterId = sourceClusterIds[0]!
    const sourceClusterBounds = diagram.nodes[sourceClusterId]?.bounds
    if (!isValidBounds(sourceClusterBounds)) continue
    const isBeyondCluster = direction === LayoutDirection.LeftToRight
      ? entry.bounds.x >= sourceClusterBounds.x + sourceClusterBounds.width
      : entry.bounds.x + entry.bounds.width <= sourceClusterBounds.x
    if (!isBeyondCluster) continue
    const group = groups.get(sourceClusterId) ?? []
    group.push(entry)
    groups.set(sourceClusterId, group)
  }

  for (const [sourceClusterId, targets] of groups) {
    if (targets.length < 2) continue
    const cluster = diagram.elements[sourceClusterId]
    const sourceRows = (cluster?.memberNodeIds ?? [])
      .map((id) => {
        const element = diagram.elements[id]
        const bounds = diagram.nodes[id]?.bounds
        return element?.type === ElementType.ClassNode && isValidBounds(bounds)
          ? { element, bounds }
          : undefined
      })
      .filter((entry): entry is DiagramNodeEntry => entry !== undefined)
      .sort((left, right) => left.bounds.y - right.bounds.y)
    targets.sort((left, right) => left.bounds.y - right.bounds.y)
    if (sourceRows.length < targets.length) continue
    const originalYs = targets.map(({ bounds }) => bounds.y)
    const currentRoutes = routeEdges(diagram as never, defaultLightTheme)
    targets.forEach(({ bounds }, index) => {
      const sourceBounds = sourceRows[index]!.bounds
      bounds.y = sourceBounds.y + (sourceBounds.height - bounds.height) / 2
    })

    const entries = classNodeEntries(diagram)
    const hasOverlap = entries.some((left, leftIndex) => entries.some((right, rightIndex) =>
      rightIndex > leftIndex && rectanglesOverlap(left.bounds, right.bounds)
    ))
    const candidateRoutes = routeEdges(diagram as never, defaultLightTheme)
    const isSafe = !hasOverlap && candidateRoutes.reduce(
      (sum, route) => sum + routeNodeIntersectionCount(route, diagram),
      0
    ) <= currentRoutes.reduce(
      (sum, route) => sum + routeNodeIntersectionCount(route, diagram),
      0
    ) && candidateRoutes.reduce(
      (sum, route) => sum + routeLabelNodeIntersectionCount(route, diagram),
      0
    ) <= currentRoutes.reduce(
      (sum, route) => sum + routeLabelNodeIntersectionCount(route, diagram),
      0
    ) && routeCrossingCount(candidateRoutes) <= routeCrossingCount(currentRoutes) &&
      routeOverlapCount(candidateRoutes) <= routeOverlapCount(currentRoutes) &&
      routeLabelOverlapCount(candidateRoutes) <= routeLabelOverlapCount(currentRoutes)

    if (!isSafe) targets.forEach(({ bounds }, index) => { bounds.y = originalYs[index]! })
  }
}

/**
 * Compound layout shares ranks across otherwise independent branches. A long
 * pipeline can therefore push a terminal sink cluster far below the consumer
 * cluster that actually feeds it. Move only sink-like clusters with one
 * predecessor cluster and no forward outgoing edges, and retain the move only
 * when cluster and edge clearance do not regress.
 */
function compactSinkLikeClusterGaps(diagram: StructureDiagram, direction: string): void {
  if (direction !== LayoutDirection.TopToBottom &&
    direction !== LayoutDirection.BottomToTop) return
  const clusters = Object.values(diagram.elements).filter((element) =>
    element.type === ElementType.Cluster && element.memberNodeIds?.length
  )

  for (const cluster of clusters) {
    const clusterBounds = diagram.nodes[cluster.id]?.bounds
    if (!isValidBounds(clusterBounds)) continue
    const memberIds = new Set(cluster.memberNodeIds)
    if ([...memberIds].some((id) => diagram.elements[id]?.type === ElementType.Cluster)) continue
    const currentRoutes = routeEdges(diagram as never, defaultLightTheme)
    const incoming = currentRoutes.filter((route) =>
      memberIds.has(route.targetNodeId) && !memberIds.has(route.sourceNodeId)
    )
    if (incoming.length === 0) continue
    const routePredecessorIds = incoming.map((route) =>
      directClusterContainingNode(diagram, route.sourceNodeId)
    )
    if (routePredecessorIds.some((id) => id === undefined)) continue
    const predecessorIds = new Set(routePredecessorIds as string[])
    if (predecessorIds.size !== 1) continue
    const [predecessorId] = predecessorIds
    const predecessorBounds = diagram.nodes[predecessorId!]?.bounds
    if (!isValidBounds(predecessorBounds)) continue

    const outgoing = currentRoutes.filter((route) =>
      memberIds.has(route.sourceNodeId) && !memberIds.has(route.targetNodeId)
    )
    const hasForwardOutgoing = outgoing.some((route) => {
      const targetBounds = diagram.nodes[route.targetNodeId]?.bounds
      if (!isValidBounds(targetBounds)) return true
      return direction === LayoutDirection.TopToBottom
        ? targetBounds.y >= clusterBounds.y + clusterBounds.height
        : targetBounds.y + targetBounds.height <= clusterBounds.y
    })
    if (hasForwardOutgoing) continue

    const gap = direction === LayoutDirection.TopToBottom
      ? clusterBounds.y - predecessorBounds.y - predecessorBounds.height
      : predecessorBounds.y - clusterBounds.y - clusterBounds.height
    if (gap <= COMPACT_CLUSTER_THRESHOLD_PX) continue
    const deltaY = direction === LayoutDirection.TopToBottom
      ? -(gap - COMPACT_CLUSTER_GAP_PX)
      : gap - COMPACT_CLUSTER_GAP_PX
    const candidateBounds = { ...clusterBounds, y: clusterBounds.y + deltaY }
    const overlapsCluster = clusters.some((other) => {
      if (other.id === cluster.id) return false
      const bounds = diagram.nodes[other.id]?.bounds
      return isValidBounds(bounds) && rectanglesOverlap(candidateBounds, bounds)
    })
    if (overlapsCluster) continue

    const movedBounds = [cluster.id, ...memberIds]
      .map((id) => diagram.nodes[id]?.bounds)
      .filter((bounds): bounds is DiagramBounds => isValidBounds(bounds))
    const currentNodeIntersections = currentRoutes.reduce(
      (sum, route) => sum + routeNodeIntersectionCount(route, diagram),
      0
    )
    const currentLabelIntersections = currentRoutes.reduce(
      (sum, route) => sum + routeLabelNodeIntersectionCount(route, diagram),
      0
    )
    for (const bounds of movedBounds) bounds.y += deltaY

    const candidateRoutes = routeEdges(diagram as never, defaultLightTheme)
    const isSafe = candidateRoutes.reduce(
      (sum, route) => sum + routeNodeIntersectionCount(route, diagram),
      0
    ) <= currentNodeIntersections && candidateRoutes.reduce(
      (sum, route) => sum + routeLabelNodeIntersectionCount(route, diagram),
      0
    ) <= currentLabelIntersections &&
      routeCrossingCount(candidateRoutes) <= routeCrossingCount(currentRoutes) &&
      routeOverlapCount(candidateRoutes) <= routeOverlapCount(currentRoutes) &&
      routeLabelOverlapCount(candidateRoutes) <= routeLabelOverlapCount(currentRoutes)

    if (!isSafe) {
      for (const bounds of movedBounds) bounds.y -= deltaY
    }
  }
}

/**
 * A centered edge label needs a rank gap at least as wide/tall as its label
 * box, plus breathing room on both sides. Shift the target rank and every rank
 * after it as one unit so downstream topology stays intact. Compound diagrams
 * are left to their cluster-aware layout because moving only leaf nodes would
 * invalidate cluster bounds.
 */
function makeRoomForForwardEdgeLabels(diagram: StructureDiagram, direction: string): void {
  if (Object.values(diagram.elements).some((element) => element.type === ElementType.Cluster)) {
    return
  }

  const processedEdges = new Set<string>()
  while (true) {
    const route = routeEdges(diagram as never, defaultLightTheme).find((candidate) => {
      if (!candidate.labelBox || processedEdges.has(candidate.edgeId)) return false
      const sourceBounds = diagram.nodes[candidate.sourceNodeId]?.bounds
      const targetBounds = diagram.nodes[candidate.targetNodeId]?.bounds
      return isValidBounds(sourceBounds) && isValidBounds(targetBounds) &&
        forwardRankGap(sourceBounds, targetBounds, direction) !== undefined
    })
    if (!route?.labelBox) break
    processedEdges.add(route.edgeId)

    const sourceBounds = diagram.nodes[route.sourceNodeId]!.bounds
    const targetBounds = diagram.nodes[route.targetNodeId]!.bounds
    const gap = forwardRankGap(sourceBounds, targetBounds, direction)
    if (gap === undefined) continue
    const labelExtent = isHorizontalDirection(direction)
      ? route.labelBox.width
      : route.labelBox.height
    const requiredGap = labelExtent + EDGE_LABEL_NODE_CLEARANCE_PX * 2
    const shift = Math.ceil(requiredGap - gap)
    if (shift <= 0) continue
    shiftTargetAndLaterRanks(diagram, targetBounds, direction, shift)
  }
}

function forwardRankGap(
  source: DiagramBounds,
  target: DiagramBounds,
  direction: string
): number | undefined {
  if (direction === LayoutDirection.LeftToRight && target.x >= source.x + source.width) {
    return target.x - source.x - source.width
  }
  if (direction === LayoutDirection.RightToLeft && target.x + target.width <= source.x) {
    return source.x - target.x - target.width
  }
  if (direction === LayoutDirection.TopToBottom && target.y >= source.y + source.height) {
    return target.y - source.y - source.height
  }
  if (direction === LayoutDirection.BottomToTop && target.y + target.height <= source.y) {
    return source.y - target.y - target.height
  }
  return undefined
}

function shiftTargetAndLaterRanks(
  diagram: StructureDiagram,
  target: DiagramBounds,
  direction: string,
  distance: number
): void {
  for (const { bounds } of classNodeEntries(diagram)) {
    if (direction === LayoutDirection.LeftToRight && bounds.x >= target.x - SAME_RANK_TOLERANCE_PX) {
      bounds.x += distance
    } else if (
      direction === LayoutDirection.RightToLeft &&
      bounds.x <= target.x + SAME_RANK_TOLERANCE_PX
    ) {
      bounds.x -= distance
    } else if (
      direction === LayoutDirection.TopToBottom &&
      bounds.y >= target.y - SAME_RANK_TOLERANCE_PX
    ) {
      bounds.y += distance
    } else if (
      direction === LayoutDirection.BottomToTop &&
      bounds.y <= target.y + SAME_RANK_TOLERANCE_PX
    ) {
      bounds.y -= distance
    }
  }
}

function primaryStart(bounds: DiagramBounds, horizontal: boolean): number {
  return horizontal ? bounds.x : bounds.y
}

function crossStart(bounds: DiagramBounds, horizontal: boolean): number {
  return horizontal ? bounds.y : bounds.x
}

function crossEnd(bounds: DiagramBounds, horizontal: boolean): number {
  return crossStart(bounds, horizontal) + crossSize(bounds, horizontal)
}

function crossCenter(bounds: DiagramBounds, horizontal: boolean): number {
  return crossStart(bounds, horizontal) + crossSize(bounds, horizontal) / 2
}

function crossSize(bounds: DiagramBounds, horizontal: boolean): number {
  return horizontal ? bounds.height : bounds.width
}

function setCrossStart(bounds: DiagramBounds, horizontal: boolean, value: number): void {
  if (horizontal) bounds.y = value
  else bounds.x = value
}

function expandDisplayToFitNodes(diagram: StructureDiagram): void {
  const entries = classNodeEntries(diagram)
  if (entries.length === 0) return
  const left = Math.min(...entries.map(({ bounds }) => bounds.x))
  const top = Math.min(...entries.map(({ bounds }) => bounds.y))
  const shiftX = Math.max(0, DISPLAY_BOUNDS_MARGIN_PX - left)
  const shiftY = Math.max(0, DISPLAY_BOUNDS_MARGIN_PX - top)
  for (const { bounds } of entries) {
    bounds.x += shiftX
    bounds.y += shiftY
  }
  const right = Math.max(...entries.map(({ bounds }) => bounds.x + bounds.width))
  const bottom = Math.max(...entries.map(({ bounds }) => bounds.y + bounds.height))
  diagram.display.width = Math.max(diagram.display.width, right + DISPLAY_BOUNDS_MARGIN_PX)
  diagram.display.height = Math.max(diagram.display.height, bottom + DISPLAY_BOUNDS_MARGIN_PX)
}

/**
 * The upstream TB edge router distributes multiple incoming ports evenly, but
 * does not obstacle-check vertical routes. A distributed target leg can then
 * pass through a node in the preceding row. Move only the affected edge's
 * attach point to the nearest clear position; clean routes remain untouched.
 */
function avoidNodeCrossingRoutes(diagram: StructureDiagram): void {
  const portRatios = Array.from(
    { length: Math.floor(100 / PORT_RATIO_STEP) + 1 },
    (_, index) => index * PORT_RATIO_STEP
  )
  const initialRoutes = routeEdges(diagram as never, defaultLightTheme)

  for (const initialRoute of initialRoutes) {
    if (routeNodeIntersectionCount(initialRoute, diagram) === 0) continue
    const link = diagram.elements[initialRoute.edgeId]
    if (!link?.port1 || !link.port2 || !diagram.ports) continue
    const sourcePort = diagram.ports[link.port1]
    const targetPort = diagram.ports[link.port2]
    if (!sourcePort || !targetPort) continue

    const originalSourceRatio = sourcePort.edgePosRatio ?? 50
    const originalTargetRatio = targetPort.edgePosRatio ?? 50
    const originalSourceAlignment = sourcePort.alignment
    const originalTargetAlignment = targetPort.alignment
    const candidates = portRatios.flatMap((sourceRatio) =>
      portRatios.map((targetRatio) => ({ sourceRatio, targetRatio }))
    ).sort((left, right) => {
      const leftDelta = Math.abs(left.sourceRatio - originalSourceRatio) +
        Math.abs(left.targetRatio - originalTargetRatio)
      const rightDelta = Math.abs(right.sourceRatio - originalSourceRatio) +
        Math.abs(right.targetRatio - originalTargetRatio)
      return leftDelta - rightDelta
    })

    let resolved = false
    for (const candidate of candidates) {
      sourcePort.edgePosRatio = candidate.sourceRatio
      targetPort.edgePosRatio = candidate.targetRatio
      const route = routeEdges(diagram as never, defaultLightTheme)
        .find((item) => item.edgeId === initialRoute.edgeId)
      if (route && routeNodeIntersectionCount(route, diagram) === 0) {
        resolved = true
        break
      }
    }

    if (!resolved && originalTargetAlignment !== undefined) {
      sourcePort.edgePosRatio = originalSourceRatio
      targetPort.edgePosRatio = originalTargetRatio
      const alternateAlignments = perpendicularPortAlignments(originalTargetAlignment)
      let best: {
        alignment: PortAlignment
        ratio: number
        centerDelta: number
        length: number
      } | undefined

      for (const alignment of alternateAlignments) {
        targetPort.alignment = alignment
        const centeredRatios = [...portRatios].sort((left, right) =>
          Math.abs(left - 50) - Math.abs(right - 50)
        )
        for (const ratio of centeredRatios) {
          targetPort.edgePosRatio = ratio
          const route = routeEdges(diagram as never, defaultLightTheme)
            .find((item) => item.edgeId === initialRoute.edgeId)
          if (!route || routeNodeIntersectionCount(route, diagram) > 0) continue
          const length = routePolylineLength(route)
          const centerDelta = Math.abs(ratio - 50)
          if (!best || centerDelta < best.centerDelta ||
            (centerDelta === best.centerDelta && length < best.length)) {
            best = { alignment, ratio, centerDelta, length }
          }
        }
      }

      if (best) {
        targetPort.alignment = best.alignment
        targetPort.edgePosRatio = best.ratio
        resolved = true
      } else {
        targetPort.alignment = originalTargetAlignment
      }
    }

    if (
      !resolved &&
      originalSourceAlignment !== undefined &&
      originalTargetAlignment !== undefined
    ) {
      sourcePort.alignment = originalSourceAlignment
      targetPort.alignment = originalTargetAlignment
      sourcePort.edgePosRatio = originalSourceRatio
      targetPort.edgePosRatio = originalTargetRatio
      const alignments = [
        PortAlignment.Top,
        PortAlignment.Right,
        PortAlignment.Bottom,
        PortAlignment.Left,
      ]
      let best: {
        sourceAlignment: PortAlignment
        targetAlignment: PortAlignment
        crossings: number
        overlaps: number
        length: number
      } | undefined

      for (const sourceAlignment of alignments) {
        for (const targetAlignment of alignments) {
          sourcePort.alignment = sourceAlignment
          targetPort.alignment = targetAlignment
          sourcePort.edgePosRatio = 50
          targetPort.edgePosRatio = 50
          const candidateRoutes = routeEdges(diagram as never, defaultLightTheme)
          const route = candidateRoutes
            .find((item) => item.edgeId === initialRoute.edgeId)
          if (!route || routeNodeIntersectionCount(route, diagram) > 0) continue
          if (routeLabelNodeIntersectionCount(route, diagram) > 0) continue
          const siblings = candidateRoutes.filter((item) => item.edgeId !== route.edgeId)
          const crossings = siblings.filter((item) => routesCross(route, item)).length
          const overlaps = siblings.filter((item) => routesOverlap(route, item)).length
          const length = routePolylineLength(route)
          if (!best || crossings < best.crossings ||
            (crossings === best.crossings && overlaps < best.overlaps) ||
            (crossings === best.crossings && overlaps === best.overlaps && length < best.length)) {
            best = { sourceAlignment, targetAlignment, crossings, overlaps, length }
          }
        }
      }

      if (best) {
        sourcePort.alignment = best.sourceAlignment
        targetPort.alignment = best.targetAlignment
        sourcePort.edgePosRatio = 50
        targetPort.edgePosRatio = 50
        resolved = true
      }
    }

    if (!resolved) {
      sourcePort.alignment = originalSourceAlignment
      targetPort.alignment = originalTargetAlignment
      sourcePort.edgePosRatio = originalSourceRatio
      targetPort.edgePosRatio = originalTargetRatio
    }
  }
}

/**
 * Obstacle repair can change one edge in a fan-out from top-entry to side-entry.
 * If a sibling keeps its old top-entry dogleg, the two orthogonal polylines can
 * weave across one another twice. Re-evaluate target faces for that source and
 * keep a centered, obstacle-free candidate only when it reduces crossings.
 */
function avoidSameSourceRouteCrossings(diagram: StructureDiagram): void {
  if (!diagram.ports) return
  const routes = routeEdges(diagram as never, defaultLightTheme)
  const sourceIds = new Set(routes.map((route) => route.sourceNodeId))

  for (const sourceId of sourceIds) {
    const sourceRoutes = routes.filter((route) => route.sourceNodeId === sourceId)
    const currentCrossings = routeCrossingCount(sourceRoutes)
    if (currentCrossings === 0) continue
    const sourceBounds = diagram.nodes[sourceId]?.bounds
    if (!isValidBounds(sourceBounds)) continue

    const snapshots: Array<{
      port: DiagramPortRecord
      alignment: PortAlignment | undefined
      ratio: number | undefined
    }> = []
    const sourceCenterX = sourceBounds.x + sourceBounds.width / 2

    for (const route of sourceRoutes) {
      const link = diagram.elements[route.edgeId]
      if (!link?.port2) continue
      const targetPort = diagram.ports[link.port2]
      const targetBounds = diagram.nodes[route.targetNodeId]?.bounds
      if (!targetPort || !isValidBounds(targetBounds)) continue
      snapshots.push({
        port: targetPort,
        alignment: targetPort.alignment,
        ratio: targetPort.edgePosRatio,
      })
      const targetCenterX = targetBounds.x + targetBounds.width / 2
      targetPort.alignment = targetCenterX <= sourceCenterX
        ? PortAlignment.Right
        : PortAlignment.Left
      targetPort.edgePosRatio = 50
    }

    const candidateRoutes = routeEdges(diagram as never, defaultLightTheme)
    const candidateSourceRoutes = candidateRoutes
      .filter((route) => route.sourceNodeId === sourceId)
    const hasClearance = candidateSourceRoutes.every((route) =>
      routeNodeIntersectionCount(route, diagram) === 0
    )
    if (hasClearance && routeCrossingCount(candidateSourceRoutes) < currentCrossings) continue

    for (const snapshot of snapshots) {
      snapshot.port.alignment = snapshot.alignment
      snapshot.port.edgePosRatio = snapshot.ratio
    }
  }
}

/**
 * Port distribution can assign two links entering the same face in the
 * opposite order from their source nodes. The resulting doglegs cross just
 * before the target. Sort those target ports along the face by source position
 * and keep the change only when it makes the whole diagram strictly better.
 */
function avoidSameTargetRouteCrossings(diagram: StructureDiagram): void {
  if (!diagram.ports) return
  const targetIds = new Set(
    routeEdges(diagram as never, defaultLightTheme).map((route) => route.targetNodeId)
  )

  for (const targetId of targetIds) {
    const currentRoutes = routeEdges(diagram as never, defaultLightTheme)
    const targetRoutes = currentRoutes.filter((route) => route.targetNodeId === targetId)
    if (targetRoutes.length < 2) continue
    const currentCrossings = routeCrossingCount(currentRoutes)
    const groups = new Map<PortAlignment, EdgeRoute[]>()

    for (const route of targetRoutes) {
      const link = diagram.elements[route.edgeId]
      if (!link?.port2) continue
      const targetPort = diagram.ports[link.port2]
      if (!targetPort || targetPort.alignment === undefined) continue
      const group = groups.get(targetPort.alignment) ?? []
      group.push(route)
      groups.set(targetPort.alignment, group)
    }

    for (const [alignment, routes] of groups) {
      if (routes.length !== 2) continue
      const verticalFace = alignment === PortAlignment.Left || alignment === PortAlignment.Right
      routes.sort((left, right) => {
        const leftStart = left.polyline[0]!
        const rightStart = right.polyline[0]!
        return verticalFace ? leftStart.y - rightStart.y : leftStart.x - rightStart.x
      })
      const snapshots: Array<{ port: DiagramPortRecord; ratio: number | undefined }> = []
      routes.forEach((route, index) => {
        const link = diagram.elements[route.edgeId]!
        const targetPort = diagram.ports![link.port2!]!
        snapshots.push({ port: targetPort, ratio: targetPort.edgePosRatio })
        targetPort.edgePosRatio = index === 0 ? 25 : 75
      })

      const candidateRoutes = routeEdges(diagram as never, defaultLightTheme)
      const edgeIds = new Set(routes.map((route) => route.edgeId))
      const candidatePair = candidateRoutes.filter((route) => edgeIds.has(route.edgeId))
      const hasClearance = candidatePair.every((route) =>
        routeNodeIntersectionCount(route, diagram) === 0
      )
      if (
        candidatePair.length === 2 &&
        hasClearance &&
        routeCrossingCount(candidateRoutes) <= currentCrossings &&
        !routesOverlap(candidatePair[0]!, candidatePair[1]!)
      ) continue

      for (const snapshot of snapshots) {
        snapshot.port.edgePosRatio = snapshot.ratio
      }
    }
  }
}

/**
 * A long fan-in sometimes cannot use a top/bottom port through the stock
 * router because its full-height final leg would cross another node. Preserve
 * the already-clear outer route, then turn toward an interior target port only
 * in the small gap immediately before the target. This fixes the visual corner
 * attachment without reopening crossings earlier in the diagram.
 */
function repairTopBottomFanInCornerAttachments(
  diagram: StructureDiagram,
  direction: string | undefined
): void {
  if (!diagram.ports) return
  const resolvedDirection = direction ?? LayoutDirection.TopToBottom
  if (resolvedDirection !== LayoutDirection.TopToBottom &&
    resolvedDirection !== LayoutDirection.BottomToTop) return
  const expectedAlignment = resolvedDirection === LayoutDirection.TopToBottom
    ? PortAlignment.Top
    : PortAlignment.Bottom
  const targetIds = new Set(
    effectiveRouteEdges(diagram).map((route) => route.targetNodeId)
  )

  for (const targetId of targetIds) {
    let currentRoutes = effectiveRouteEdges(diagram)
    const initialFanIn = currentRoutes.filter((route) => route.targetNodeId === targetId)
    if (initialFanIn.length < 2) continue
    const targetBounds = diagram.nodes[targetId]?.bounds
    const targetClusterId = directClusterContainingNode(diagram, targetId)
    if (!targetClusterId || !isValidBounds(targetBounds) || !initialFanIn.every((route) => {
      const sourceBounds = diagram.nodes[route.sourceNodeId]?.bounds
      const sourceClusterId = directClusterContainingNode(diagram, route.sourceNodeId)
      if (!sourceClusterId || sourceClusterId === targetClusterId ||
        !isValidBounds(sourceBounds)) return false
      return resolvedDirection === LayoutDirection.TopToBottom
        ? sourceBounds.y + sourceBounds.height <= targetBounds.y
        : sourceBounds.y >= targetBounds.y + targetBounds.height
    })) continue

    for (const initialRoute of initialFanIn) {
      currentRoutes = effectiveRouteEdges(diagram)
      const currentRoute = currentRoutes.find((route) => route.edgeId === initialRoute.edgeId)
      const link = diagram.elements[initialRoute.edgeId]
      if (!currentRoute || !link?.port2) continue
      const targetPort = diagram.ports[link.port2]
      if (!targetPort) continue
      const currentRatio = targetPort.edgePosRatio ?? 50
      if (targetPort.alignment === expectedAlignment &&
        currentRatio > STRAIGHT_ROUTE_PORT_MARGIN_PERCENT &&
        currentRatio < 100 - STRAIGHT_ROUTE_PORT_MARGIN_PERCENT) continue

      const otherRatios = initialFanIn
        .filter((route) => route.edgeId !== initialRoute.edgeId)
        .map((route) => {
          const otherLink = diagram.elements[route.edgeId]
          return otherLink?.port2 ? diagram.ports![otherLink.port2] : undefined
        })
        .filter((port) => port?.alignment === expectedAlignment)
        .map((port) => port!.edgePosRatio ?? 50)
      const endpoint = currentRoute.polyline[currentRoute.polyline.length - 1]!
      const entersFromRight = endpoint.x >= targetBounds.x + targetBounds.width / 2
      const nearestRatio = otherRatios.length > 0 ? otherRatios[0]! : 50
      const desiredRatio = entersFromRight
        ? Math.min(85, Math.max(65, nearestRatio + 15))
        : Math.max(15, Math.min(35, nearestRatio - 15))
      const targetPoint = {
        x: targetBounds.x + targetBounds.width * desiredRatio / 100,
        y: resolvedDirection === LayoutDirection.TopToBottom
          ? targetBounds.y
          : targetBounds.y + targetBounds.height,
      }
      const approachY = targetPoint.y + (
        resolvedDirection === LayoutDirection.TopToBottom
          ? -BUS_ROUTE_MIN_LANE_GAP_PX
          : BUS_ROUTE_MIN_LANE_GAP_PX
      )
      let anchorIndex = -1
      for (let index = currentRoute.polyline.length - 2; index >= 0; index--) {
        const point = currentRoute.polyline[index]!
        const isBeforeTarget = resolvedDirection === LayoutDirection.TopToBottom
          ? point.y <= approachY
          : point.y >= approachY
        if (isBeforeTarget) {
          anchorIndex = index
          break
        }
      }
      if (anchorIndex < 0) continue

      const fallbackPolyline = currentRoute.polyline.slice(0, anchorIndex + 1)
      appendRoutePoint(fallbackPolyline, {
        x: fallbackPolyline[fallbackPolyline.length - 1]!.x,
        y: approachY,
      })
      appendRoutePoint(fallbackPolyline, { x: targetPoint.x, y: approachY })
      appendRoutePoint(fallbackPolyline, targetPoint)
      const candidatePolylines: Array<EdgeRoute['polyline']> = []
      const anchor = currentRoute.polyline[anchorIndex]!
      const previous = currentRoute.polyline[anchorIndex - 1]
      if (previous?.y === anchor.y) {
        const directPolyline = currentRoute.polyline.slice(0, anchorIndex)
        appendRoutePoint(directPolyline, { x: targetPoint.x, y: anchor.y })
        appendRoutePoint(directPolyline, targetPoint)
        candidatePolylines.push(directPolyline)
      }
      candidatePolylines.push(fallbackPolyline)

      const snapshot = {
        alignment: targetPort.alignment,
        ratio: targetPort.edgePosRatio,
        polyline: link.axonizeRoutePolyline,
        labelOffset: link.axonizeRouteLabelOffset,
      }
      targetPort.alignment = expectedAlignment
      targetPort.edgePosRatio = desiredRatio
      const baseRoutes = routeEdges(diagram as never, defaultLightTheme)
      const baseCandidate = baseRoutes.find((route) => route.edgeId === currentRoute.edgeId)
      if (!baseCandidate) {
        restoreRouteAttachment(link, targetPort, snapshot)
        continue
      }
      const baseMidpoint = routePolylineMidpoint(baseCandidate.polyline)
      let accepted: {
        polyline: EdgeRoute['polyline']
        labelOffset: { x: number; y: number } | undefined
      } | undefined
      for (const polyline of candidatePolylines) {
        const customMidpoint = routePolylineMidpoint(polyline)
        const labelOffset = baseCandidate.labelBox
          ? {
              x: customMidpoint.x - baseMidpoint.x,
              y: customMidpoint.y - baseMidpoint.y,
            }
          : undefined
        const customRoute: EdgeRoute = {
          ...baseCandidate,
          polyline,
          labelBox: baseCandidate.labelBox && labelOffset
            ? {
                ...baseCandidate.labelBox,
                x: baseCandidate.labelBox.x + labelOffset.x,
                y: baseCandidate.labelBox.y + labelOffset.y,
              }
            : baseCandidate.labelBox,
        }
        const candidateRoutes = baseRoutes.map((route) => {
          if (route.edgeId === customRoute.edgeId) return customRoute
          return effectiveRoute(diagram, route)
        })
        const isSafe = routeNodeIntersectionCount(customRoute, diagram) === 0 &&
          routeLabelNodeIntersectionCount(customRoute, diagram) === 0 &&
          routeCrossingCount(candidateRoutes) <= routeCrossingCount(currentRoutes) &&
          routeOverlapCount(candidateRoutes) <= routeOverlapCount(currentRoutes) &&
          routeLabelOverlapCount(candidateRoutes) <= routeLabelOverlapCount(currentRoutes)
        if (isSafe) {
          accepted = { polyline, labelOffset }
          break
        }
      }

      if (accepted) {
        link.axonizeRoutePolyline = accepted.polyline
        link.axonizeRouteLabelOffset = accepted.labelOffset
      } else {
        restoreRouteAttachment(link, targetPort, snapshot)
      }
    }
  }
}

function effectiveRouteEdges(diagram: StructureDiagram): EdgeRoute[] {
  return routeEdges(diagram as never, defaultLightTheme).map((route) =>
    effectiveRoute(diagram, route)
  )
}

function effectiveRoute(diagram: StructureDiagram, route: EdgeRoute): EdgeRoute {
  const link = diagram.elements[route.edgeId]
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
}

function appendRoutePoint(
  polyline: EdgeRoute['polyline'],
  point: EdgeRoute['polyline'][number]
): void {
  const previous = polyline[polyline.length - 1]
  if (!previous || previous.x !== point.x || previous.y !== point.y) polyline.push(point)
}

function restoreRouteAttachment(
  link: DiagramElement,
  targetPort: DiagramPortRecord,
  snapshot: {
    alignment: PortAlignment | undefined
    ratio: number | undefined
    polyline: EdgeRoute['polyline'] | undefined
    labelOffset: { x: number; y: number } | undefined
  }
): void {
  targetPort.alignment = snapshot.alignment
  targetPort.edgePosRatio = snapshot.ratio
  link.axonizeRoutePolyline = snapshot.polyline
  link.axonizeRouteLabelOffset = snapshot.labelOffset
}

/**
 * The orthogonal router centers a lone target port even when the source port
 * already lines up with the target face. That introduces a short dogleg which
 * carries no routing value. Align the target port to the source coordinate
 * only when this produces one clear segment and does not worsen the rest of
 * the diagram. Multi-input targets remain under the fan-in ordering repair.
 */
function straightenSingleIncomingRoutes(diagram: StructureDiagram): void {
  if (!diagram.ports) return
  const targetCounts = new Map<string, number>()
  for (const route of routeEdges(diagram as never, defaultLightTheme)) {
    targetCounts.set(route.targetNodeId, (targetCounts.get(route.targetNodeId) ?? 0) + 1)
  }

  const edgeIds = routeEdges(diagram as never, defaultLightTheme).map((route) => route.edgeId)
  for (const edgeId of edgeIds) {
    const currentRoutes = routeEdges(diagram as never, defaultLightTheme)
    const currentRoute = currentRoutes.find((route) => route.edgeId === edgeId)
    if (!currentRoute || currentRoute.polyline.length <= 2) continue
    if (targetCounts.get(currentRoute.targetNodeId) !== 1) continue

    const link = diagram.elements[edgeId]
    if (!link?.port1 || !link.port2) continue
    const sourcePort = diagram.ports[link.port1]
    const targetPort = diagram.ports[link.port2]
    const targetBounds = diagram.nodes[currentRoute.targetNodeId]?.bounds
    if (!sourcePort || !targetPort || !isValidBounds(targetBounds)) continue

    const ratio = alignedTargetPortRatio(
      currentRoute.polyline[0]!,
      sourcePort.alignment,
      targetPort.alignment,
      targetBounds
    )
    if (ratio === undefined ||
      ratio < STRAIGHT_ROUTE_PORT_MARGIN_PERCENT ||
      ratio > 100 - STRAIGHT_ROUTE_PORT_MARGIN_PERCENT) continue

    const originalRatio = targetPort.edgePosRatio
    const originalLength = routePolylineLength(currentRoute)
    const originalCrossings = routeCrossingCount(currentRoutes)
    targetPort.edgePosRatio = ratio

    const candidateRoutes = routeEdges(diagram as never, defaultLightTheme)
    const candidate = candidateRoutes.find((route) => route.edgeId === edgeId)
    const siblings = candidateRoutes.filter((route) => route.edgeId !== edgeId)
    const isBetter = candidate !== undefined &&
      candidate.polyline.length === 2 &&
      routePolylineLength(candidate) < originalLength &&
      routeNodeIntersectionCount(candidate, diagram) === 0 &&
      routeLabelNodeIntersectionCount(candidate, diagram) === 0 &&
      routeCrossingCount(candidateRoutes) <= originalCrossings &&
      siblings.every((route) => !routesOverlap(candidate, route))

    if (!isBetter) targetPort.edgePosRatio = originalRatio
  }
}

function alignedTargetPortRatio(
  sourcePoint: EdgeRoute['polyline'][number],
  sourceAlignment: PortAlignment | undefined,
  targetAlignment: PortAlignment | undefined,
  targetBounds: DiagramBounds
): number | undefined {
  if (sourceAlignment === PortAlignment.Right && targetAlignment === PortAlignment.Left &&
    targetBounds.x >= sourcePoint.x) {
    return (sourcePoint.y - targetBounds.y) / targetBounds.height * 100
  }
  if (sourceAlignment === PortAlignment.Left && targetAlignment === PortAlignment.Right &&
    targetBounds.x + targetBounds.width <= sourcePoint.x) {
    return (sourcePoint.y - targetBounds.y) / targetBounds.height * 100
  }
  if (sourceAlignment === PortAlignment.Bottom && targetAlignment === PortAlignment.Top &&
    targetBounds.y >= sourcePoint.y) {
    return (sourcePoint.x - targetBounds.x) / targetBounds.width * 100
  }
  if (sourceAlignment === PortAlignment.Top && targetAlignment === PortAlignment.Bottom &&
    targetBounds.y + targetBounds.height <= sourcePoint.y) {
    return (sourcePoint.x - targetBounds.x) / targetBounds.width * 100
  }
  return undefined
}

/**
 * Parallel cross-cluster routes share the same midpoint, so their long middle
 * sections can collapse into one ambiguous bus. Give the overlapping routes
 * separate channel lanes and move their labels with them.
 * Candidate lane orders are accepted only when they reduce overlap without
 * adding crossings, label collisions, or node intersections; the node layout
 * and port assignments remain unchanged.
 */
function separateOverlappingRouteBuses(
  diagram: StructureDiagram,
  direction: string | undefined
): void {
  const resolvedDirection = direction ?? LayoutDirection.TopToBottom
  const horizontalFlow = isHorizontalDirection(resolvedDirection)
  if (!horizontalFlow && resolvedDirection !== LayoutDirection.TopToBottom &&
    resolvedDirection !== LayoutDirection.BottomToTop) return
  if (!diagram.ports) return

  let workingRoutes = routeEdges(diagram as never, defaultLightTheme)
  const routeGroups = new Map<string, EdgeRoute[]>()
  for (const route of workingRoutes) {
    if (route.polyline.length !== 4) continue
    const link = diagram.elements[route.edgeId]
    if (!link?.port1 || !link.port2) continue
    const sourcePort = diagram.ports[link.port1]
    const targetPort = diagram.ports[link.port2]
    const expectedSourceAlignment = resolvedDirection === LayoutDirection.TopToBottom
      ? PortAlignment.Bottom
      : resolvedDirection === LayoutDirection.BottomToTop
        ? PortAlignment.Top
        : resolvedDirection === LayoutDirection.LeftToRight
          ? PortAlignment.Right
          : PortAlignment.Left
    const expectedTargetAlignment = resolvedDirection === LayoutDirection.TopToBottom
      ? PortAlignment.Top
      : resolvedDirection === LayoutDirection.BottomToTop
        ? PortAlignment.Bottom
        : resolvedDirection === LayoutDirection.LeftToRight
          ? PortAlignment.Left
          : PortAlignment.Right
    if (sourcePort?.alignment !== expectedSourceAlignment ||
      targetPort?.alignment !== expectedTargetAlignment) continue

    const sourceClusterId = directClusterContainingNode(diagram, route.sourceNodeId)
    const targetClusterId = directClusterContainingNode(diagram, route.targetNodeId)
    if (!sourceClusterId || sourceClusterId === targetClusterId ||
      (!horizontalFlow && !targetClusterId)) continue
    const key = `${sourceClusterId}\u0000${targetClusterId ?? '__external__'}`
    const group = routeGroups.get(key) ?? []
    group.push(route)
    routeGroups.set(key, group)
  }

  for (const [key, group] of routeGroups) {
    const affectedIds = new Set(
      group
        .filter((route) => group.some((other) =>
          route.edgeId !== other.edgeId && routesOverlap(route, other)
        ))
        .map((route) => route.edgeId)
    )
    if (affectedIds.size < 2) continue

    const [sourceClusterId, targetGroupId] = key.split('\u0000')
    const sourceClusterBounds = diagram.nodes[sourceClusterId!]?.bounds
    const targetClusterBounds = targetGroupId === '__external__'
      ? undefined
      : diagram.nodes[targetGroupId!]?.bounds
    if (!isValidBounds(sourceClusterBounds) ||
      (!horizontalFlow && !isValidBounds(targetClusterBounds))) continue

    const affected = workingRoutes.filter((route) => affectedIds.has(route.edgeId))
    const sourceBoundary = resolvedDirection === LayoutDirection.TopToBottom
      ? sourceClusterBounds.y + sourceClusterBounds.height
      : resolvedDirection === LayoutDirection.BottomToTop
        ? sourceClusterBounds.y
        : resolvedDirection === LayoutDirection.LeftToRight
          ? sourceClusterBounds.x + sourceClusterBounds.width
          : sourceClusterBounds.x
    const targetBoundary = resolvedDirection === LayoutDirection.TopToBottom
      ? targetClusterBounds!.y
      : resolvedDirection === LayoutDirection.BottomToTop
        ? targetClusterBounds!.y + targetClusterBounds!.height
        : resolvedDirection === LayoutDirection.LeftToRight
          ? targetClusterBounds?.x ?? Math.min(...group.map((route) =>
              route.polyline[route.polyline.length - 1]!.x
            ))
          : targetClusterBounds
            ? targetClusterBounds.x + targetClusterBounds.width
            : Math.max(...group.map((route) =>
                route.polyline[route.polyline.length - 1]!.x
              ))
    const laneMin = Math.min(sourceBoundary, targetBoundary) + BUS_ROUTE_CLUSTER_CLEARANCE_PX
    const laneMax = Math.max(sourceBoundary, targetBoundary) - BUS_ROUTE_CLUSTER_CLEARANCE_PX
    const availableLaneGap = (laneMax - laneMin) / (affected.length - 1)
    const laneGap = Math.min(BUS_ROUTE_LANE_GAP_PX, availableLaneGap)
    if (laneGap < BUS_ROUTE_MIN_LANE_GAP_PX) continue
    const laneSpan = laneGap * (affected.length - 1)

    const originalCenter = affected.reduce(
      (sum, route) => sum + (horizontalFlow
        ? route.polyline[1]!.x
        : route.polyline[1]!.y),
      0
    ) / affected.length
    const center = Math.min(
      laneMax - laneSpan / 2,
      Math.max(laneMin + laneSpan / 2, originalCenter)
    )
    const lanes = affected.map((_, index) =>
      center + (index - (affected.length - 1) / 2) * laneGap
    )

    const routeOrders = horizontalFlow
      ? [
          [...affected].sort(compareRouteSourceY),
          [...affected].sort(compareRouteTargetY),
        ]
      : [
          [...affected].sort(compareRouteSourceX),
          [...affected].sort(compareRouteTargetX),
    ]
    let bestRoutes: EdgeRoute[] | undefined
    const originalOverlaps = routeOverlapCount(workingRoutes)
    const originalCrossings = routeCrossingCount(workingRoutes)
    const originalLabelOverlaps = routeLabelOverlapCount(workingRoutes)
    const maxCrossings = horizontalFlow ? Number.POSITIVE_INFINITY : originalCrossings
    let bestOverlaps = Number.POSITIVE_INFINITY
    let bestCrossings = Number.POSITIVE_INFINITY
    let bestLabelOverlaps = Number.POSITIVE_INFINITY
    const tried = new Set<string>()

    for (const order of routeOrders) {
      for (const laneOrder of [lanes, [...lanes].reverse()]) {
        const laneByEdge = new Map(order.map((route, index) => [route.edgeId, laneOrder[index]!]))
        const signature = order.map((route) => `${route.edgeId}:${laneByEdge.get(route.edgeId)}`).join('|')
        if (tried.has(signature)) continue
        tried.add(signature)

        const candidateRoutes = workingRoutes.map((route) => {
          const lane = laneByEdge.get(route.edgeId)
          return lane === undefined
            ? route
            : horizontalFlow
              ? routeWithVerticalLane(route, lane)
              : routeWithHorizontalLane(route, lane)
        })
        const candidateAffected = candidateRoutes.filter((route) => affectedIds.has(route.edgeId))
        if (candidateAffected.some((route) =>
          routeNodeIntersectionCount(route, diagram) > 0 ||
          routeLabelNodeIntersectionCount(route, diagram) > 0
        )) {
          continue
        }
        const overlaps = routeOverlapCount(candidateRoutes)
        const crossings = routeCrossingCount(candidateRoutes)
        const labelOverlaps = routeLabelOverlapCount(candidateRoutes)
        if (overlaps >= originalOverlaps ||
          crossings > maxCrossings ||
          labelOverlaps > originalLabelOverlaps) continue
        if (bestRoutes && (crossings > bestCrossings ||
          (crossings === bestCrossings && overlaps > bestOverlaps) ||
          (crossings === bestCrossings && overlaps === bestOverlaps &&
            labelOverlaps >= bestLabelOverlaps))) continue
        bestRoutes = candidateRoutes
        bestOverlaps = overlaps
        bestCrossings = crossings
        bestLabelOverlaps = labelOverlaps
      }
    }

    if (bestRoutes) workingRoutes = bestRoutes
  }

  const originalById = new Map(
    routeEdges(diagram as never, defaultLightTheme).map((route) => [route.edgeId, route])
  )
  for (const route of workingRoutes) {
    const original = originalById.get(route.edgeId)
    if (!original || polylinesEqual(original.polyline, route.polyline)) continue
    const link = diagram.elements[route.edgeId]!
    link.axonizeRoutePolyline = route.polyline
    if (original.labelBox && route.labelBox) {
      link.axonizeRouteLabelOffset = {
        x: route.labelBox.x - original.labelBox.x,
        y: route.labelBox.y - original.labelBox.y,
      }
    }
  }
}

function directClusterContainingNode(
  diagram: StructureDiagram,
  nodeId: string
): string | undefined {
  return Object.values(diagram.elements).find((element) =>
    element.type === ElementType.Cluster && element.memberNodeIds?.includes(nodeId)
  )?.id
}

function compareRouteSourceX(left: EdgeRoute, right: EdgeRoute): number {
  return left.polyline[0]!.x - right.polyline[0]!.x ||
    left.polyline[left.polyline.length - 1]!.x - right.polyline[right.polyline.length - 1]!.x
}

function compareRouteTargetX(left: EdgeRoute, right: EdgeRoute): number {
  return left.polyline[left.polyline.length - 1]!.x -
    right.polyline[right.polyline.length - 1]!.x ||
    left.polyline[0]!.x - right.polyline[0]!.x
}

function compareRouteSourceY(left: EdgeRoute, right: EdgeRoute): number {
  return left.polyline[0]!.y - right.polyline[0]!.y ||
    left.polyline[left.polyline.length - 1]!.y - right.polyline[right.polyline.length - 1]!.y
}

function compareRouteTargetY(left: EdgeRoute, right: EdgeRoute): number {
  return left.polyline[left.polyline.length - 1]!.y -
    right.polyline[right.polyline.length - 1]!.y ||
    left.polyline[0]!.y - right.polyline[0]!.y
}

function routeWithHorizontalLane(route: EdgeRoute, y: number): EdgeRoute {
  const source = route.polyline[0]!
  const target = route.polyline[route.polyline.length - 1]!
  const polyline = [source, { x: source.x, y }, { x: target.x, y }, target]
  const midpoint = routePolylineMidpoint(polyline)
  const labelBox = route.labelBox
    ? {
        ...route.labelBox,
        x: midpoint.x - route.labelBox.width / 2,
        y: midpoint.y - route.labelBox.height / 2,
      }
    : undefined
  return {
    ...route,
    polyline,
    labelBox,
  }
}

function routeWithVerticalLane(route: EdgeRoute, x: number): EdgeRoute {
  const source = route.polyline[0]!
  const target = route.polyline[route.polyline.length - 1]!
  const polyline = [source, { x, y: source.y }, { x, y: target.y }, target]
  const midpoint = routePolylineMidpoint(polyline)
  const labelBox = route.labelBox
    ? {
        ...route.labelBox,
        x: midpoint.x - route.labelBox.width / 2,
        y: midpoint.y - route.labelBox.height / 2,
      }
    : undefined
  return {
    ...route,
    polyline,
    labelBox,
  }
}

function routePolylineMidpoint(polyline: EdgeRoute['polyline']): EdgeRoute['polyline'][number] {
  const totalLength = polyline.reduce((sum, point, index) => {
    if (index === 0) return sum
    const previous = polyline[index - 1]!
    return sum + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)
  }, 0)
  let remaining = totalLength / 2
  for (let index = 1; index < polyline.length; index++) {
    const start = polyline[index - 1]!
    const end = polyline[index]!
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      }
    }
    remaining -= length
  }
  return polyline[polyline.length - 1]!
}

function routeOverlapCount(routes: EdgeRoute[]): number {
  let count = 0
  for (let left = 0; left < routes.length; left++) {
    for (let right = left + 1; right < routes.length; right++) {
      if (routesOverlap(routes[left]!, routes[right]!)) count++
    }
  }
  return count
}

function routeLabelOverlapCount(routes: EdgeRoute[]): number {
  let count = 0
  for (let left = 0; left < routes.length; left++) {
    const leftBox = routes[left]!.labelBox
    if (!leftBox) continue
    for (let right = left + 1; right < routes.length; right++) {
      const rightBox = routes[right]!.labelBox
      if (rightBox && rectanglesOverlap(leftBox, rightBox)) count++
    }
  }
  return count
}

function polylinesEqual(left: EdgeRoute['polyline'], right: EdgeRoute['polyline']): boolean {
  return left.length === right.length && left.every((point, index) =>
    point.x === right[index]!.x && point.y === right[index]!.y
  )
}

function routeCrossingCount(routes: EdgeRoute[]): number {
  let count = 0
  for (let left = 0; left < routes.length; left++) {
    for (let right = left + 1; right < routes.length; right++) {
      if (routesCross(routes[left]!, routes[right]!)) count++
    }
  }
  return count
}

function routesCross(left: EdgeRoute, right: EdgeRoute): boolean {
  for (let leftIndex = 1; leftIndex < left.polyline.length; leftIndex++) {
    for (let rightIndex = 1; rightIndex < right.polyline.length; rightIndex++) {
      if (segmentsCross(
        left.polyline[leftIndex - 1]!,
        left.polyline[leftIndex]!,
        right.polyline[rightIndex - 1]!,
        right.polyline[rightIndex]!
      )) return true
    }
  }
  return false
}

function routesOverlap(left: EdgeRoute, right: EdgeRoute): boolean {
  for (let leftIndex = 1; leftIndex < left.polyline.length; leftIndex++) {
    for (let rightIndex = 1; rightIndex < right.polyline.length; rightIndex++) {
      if (segmentsOverlap(
        left.polyline[leftIndex - 1]!,
        left.polyline[leftIndex]!,
        right.polyline[rightIndex - 1]!,
        right.polyline[rightIndex]!
      )) return true
    }
  }
  return false
}

function segmentsOverlap(
  firstStart: EdgeRoute['polyline'][number],
  firstEnd: EdgeRoute['polyline'][number],
  secondStart: EdgeRoute['polyline'][number],
  secondEnd: EdgeRoute['polyline'][number]
): boolean {
  if (firstStart.y === firstEnd.y && secondStart.y === secondEnd.y &&
    firstStart.y === secondStart.y) {
    const firstMin = Math.min(firstStart.x, firstEnd.x)
    const firstMax = Math.max(firstStart.x, firstEnd.x)
    const secondMin = Math.min(secondStart.x, secondEnd.x)
    const secondMax = Math.max(secondStart.x, secondEnd.x)
    return Math.min(firstMax, secondMax) > Math.max(firstMin, secondMin)
  }
  if (firstStart.x === firstEnd.x && secondStart.x === secondEnd.x &&
    firstStart.x === secondStart.x) {
    const firstMin = Math.min(firstStart.y, firstEnd.y)
    const firstMax = Math.max(firstStart.y, firstEnd.y)
    const secondMin = Math.min(secondStart.y, secondEnd.y)
    const secondMax = Math.max(secondStart.y, secondEnd.y)
    return Math.min(firstMax, secondMax) > Math.max(firstMin, secondMin)
  }
  return false
}

function segmentsCross(
  firstStart: EdgeRoute['polyline'][number],
  firstEnd: EdgeRoute['polyline'][number],
  secondStart: EdgeRoute['polyline'][number],
  secondEnd: EdgeRoute['polyline'][number]
): boolean {
  const cross = (
    origin: EdgeRoute['polyline'][number],
    end: EdgeRoute['polyline'][number],
    point: EdgeRoute['polyline'][number]
  ) => (end.x - origin.x) * (point.y - origin.y) -
    (end.y - origin.y) * (point.x - origin.x)
  const firstSideA = cross(secondStart, secondEnd, firstStart)
  const firstSideB = cross(secondStart, secondEnd, firstEnd)
  const secondSideA = cross(firstStart, firstEnd, secondStart)
  const secondSideB = cross(firstStart, firstEnd, secondEnd)
  return firstSideA * firstSideB < 0 && secondSideA * secondSideB < 0
}

function perpendicularPortAlignments(alignment: PortAlignment): PortAlignment[] {
  if (alignment === PortAlignment.Top || alignment === PortAlignment.Bottom) {
    return [PortAlignment.Left, PortAlignment.Right]
  }
  return [PortAlignment.Top, PortAlignment.Bottom]
}

function routePolylineLength(route: EdgeRoute): number {
  let length = 0
  for (let index = 1; index < route.polyline.length; index++) {
    const previous = route.polyline[index - 1]!
    const current = route.polyline[index]!
    length += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)
  }
  return length
}

function routeNodeIntersectionCount(route: EdgeRoute, diagram: StructureDiagram): number {
  let count = 0
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.ClassNode) continue
    if (element.id === route.sourceNodeId || element.id === route.targetNodeId) continue
    const bounds = diagram.nodes[element.id]?.bounds
    if (!isValidBounds(bounds)) continue
    const obstacle = inflate(bounds, ROUTE_OBSTACLE_CLEARANCE_PX, ROUTE_OBSTACLE_CLEARANCE_PX)
    for (let index = 1; index < route.polyline.length; index++) {
      if (segmentEntersRect(route.polyline[index - 1]!, route.polyline[index]!, obstacle)) {
        count++
        break
      }
    }
  }
  return count
}

function routeLabelNodeIntersectionCount(route: EdgeRoute, diagram: StructureDiagram): number {
  if (!route.labelBox) return 0
  let count = 0
  for (const { bounds } of classNodeEntries(diagram)) {
    if (rectanglesOverlap(route.labelBox, bounds)) count++
  }
  return count
}

function rectanglesOverlap(left: DiagramBounds, right: DiagramBounds): boolean {
  return left.x < right.x + right.width &&
    right.x < left.x + left.width &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height
}

function patchFlowchartEdgeRoutes(svg: string, diagram: StructureDiagram): string {
  const routes = routeEdges(diagram as never, defaultLightTheme)
  let routeIndex = 0
  return svg.replace(
    /(<path\b(?=[^>]*\bmarker-end="url\(#arrow\)")[^>]*\/>)(<text\b[\s\S]*?<\/text>)?/g,
    (_chunk, path: string, label: string | undefined) => {
      const route = routes[routeIndex++]
      if (!route) return path + (label ?? '')
      const link = diagram.elements[route.edgeId]
      const polyline = link?.axonizeRoutePolyline
      const offset = link?.axonizeRouteLabelOffset
      const patchedPath = polyline
        ? path.replace(/\bd="[^"]*"/, `d="${edgePolylinePath(polyline)}"`)
        : path
      const patchedLabel = label && offset
        ? label.replace(
            '<text ',
            `<text transform="translate(${offset.x} ${offset.y})" `
          )
        : (label ?? '')
      return patchedPath + patchedLabel
    }
  )
}

function edgePolylinePath(polyline: EdgeRoute['polyline']): string {
  const [first, ...rest] = polyline
  if (!first) return ''
  return [`M ${first.x} ${first.y}`, ...rest.map((point) => `L ${point.x} ${point.y}`)]
    .join(' ')
}

function patchUnsupportedFlowchartShapes(svg: string, diagram: StructureDiagram): string {
  let result = svg
  for (const element of Object.values(diagram.elements)) {
    if (!element.axonizeFlowchartShape || !element.sourceId) continue
    const bounds = diagram.nodes[element.id]?.bounds
    if (!isValidBounds(bounds)) continue
    if (element.axonizeFlowchartShape === AxonizeFlowchartShape.Hexagon) {
      result = replaceNodeRectWithHexagon(result, element.sourceId, bounds)
    } else if (element.axonizeFlowchartShape === AxonizeFlowchartShape.Database) {
      result = replaceNodeRectWithDatabase(result, element.sourceId, bounds)
    } else if (element.axonizeFlowchartShape === AxonizeFlowchartShape.Subroutine) {
      result = addSubroutineBorders(result, element.sourceId, bounds)
    }
  }
  return result
}

function replaceNodeRectWithHexagon(svg: string, sourceId: string, bounds: DiagramBounds): string {
  return replaceNodeRect(svg, sourceId, (rect) => {
    const paint = nodeRectPaintAttributes(rect)
    const inset = Math.min(bounds.width * 0.12, bounds.height * 0.25)
    const points = [
      `${bounds.x + inset},${bounds.y}`,
      `${bounds.x + bounds.width - inset},${bounds.y}`,
      `${bounds.x + bounds.width},${bounds.y + bounds.height / 2}`,
      `${bounds.x + bounds.width - inset},${bounds.y + bounds.height}`,
      `${bounds.x + inset},${bounds.y + bounds.height}`,
      `${bounds.x},${bounds.y + bounds.height / 2}`,
    ].join(' ')
    return `<polygon points="${points}"${paint} />`
  })
}

function replaceNodeRectWithDatabase(
  svg: string,
  sourceId: string,
  bounds: DiagramBounds
): string {
  return replaceNodeRect(svg, sourceId, (rect) => {
    const paint = nodeRectPaintAttributes(rect)
    const stroke = nodeRectStrokeAttributes(rect)
    const { x, y, width, height } = bounds
    const capDepth = Math.min(9, height * 0.12)
    const right = x + width
    const bottom = y + height
    const bodyPath = [
      `M${x},${y + capDepth}`,
      `C${x},${y} ${right},${y} ${right},${y + capDepth}`,
      `L${right},${bottom - capDepth}`,
      `C${right},${bottom} ${x},${bottom} ${x},${bottom - capDepth}`,
      'Z',
    ].join(' ')
    const rimPath = [
      `M${x},${y + capDepth}`,
      `C${x},${y + capDepth * 2} ${right},${y + capDepth * 2} ${right},${y + capDepth}`,
    ].join(' ')
    return `<path d="${bodyPath}"${paint} /><path d="${rimPath}" fill="none"${stroke} />`
  })
}

function addSubroutineBorders(svg: string, sourceId: string, bounds: DiagramBounds): string {
  return replaceNodeRect(svg, sourceId, (rect) => {
    const stroke = nodeRectStrokeAttributes(rect)
    const inset = Math.min(8, bounds.width * 0.06)
    const left = bounds.x + inset
    const right = bounds.x + bounds.width - inset
    const top = bounds.y
    const bottom = bounds.y + bounds.height
    const borders = `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"${stroke} /><line x1="${right}" y1="${top}" x2="${right}" y2="${bottom}"${stroke} />`
    return rect + borders
  })
}

function replaceNodeRect(
  svg: string,
  sourceId: string,
  replacement: (rect: string) => string
): string {
  const groupStart = `<g data-node-id="${escapeXml(sourceId)}">`
  const groupIndex = svg.indexOf(groupStart)
  if (groupIndex < 0) return svg
  const groupEnd = svg.indexOf('</g>', groupIndex + groupStart.length)
  if (groupEnd < 0) return svg
  const rectStart = svg.indexOf('<rect ', groupIndex + groupStart.length)
  if (rectStart < 0 || rectStart >= groupEnd) return svg
  const rectEnd = svg.indexOf('/>', rectStart)
  if (rectEnd < 0 || rectEnd >= groupEnd) return svg

  const rect = svg.slice(rectStart, rectEnd + 2)
  return svg.slice(0, rectStart) + replacement(rect) + svg.slice(rectEnd + 2)
}

function nodeRectPaintAttributes(rect: string): string {
  return Array.from(rect.matchAll(/\s(?:fill|fill-opacity|stroke|stroke-width)="[^"]*"/g))
    .map((match) => match[0])
    .join('')
}

function nodeRectStrokeAttributes(rect: string): string {
  return Array.from(rect.matchAll(/\s(?:stroke|stroke-width)="[^"]*"/g))
    .map((match) => match[0])
    .join('')
}

function protectQuotedLabelClosingBrackets(source: string): string {
  return source
    .split('\n')
    .map(line => (line.trimStart().startsWith('%%') ? line : protectQuotedLineClosingBrackets(line)))
    .join('\n')
}

function protectQuotedLineClosingBrackets(line: string): string {
  let quote: '"' | '`' | undefined
  let escaped = false
  let result = ''

  for (const char of line) {
    if (quote) {
      if (escaped) {
        result += char
        escaped = false
        continue
      }
      if (char === '\\') {
        result += char
        escaped = true
        continue
      }
      if (char === quote) {
        quote = undefined
      }
      result += char === ']' ? MERMAID_QUOTED_LABEL_RIGHT_BRACKET_PLACEHOLDER : char
      continue
    }

    if (char === '"' || char === '`') {
      quote = char
    }
    result += char
  }

  return result
}

function restoreQuotedLabelClosingBrackets(diagram: StructureDiagram): void {
  for (const element of Object.values(diagram.elements)) {
    if (typeof element?.text !== 'string') continue
    element.text = restoreQuotedLabelText(element.text)
  }
}

function restoreQuotedLabelText(text: string): string {
  if (!text.includes(MERMAID_QUOTED_LABEL_RIGHT_BRACKET_PLACEHOLDER)) return text
  return text.split(MERMAID_QUOTED_LABEL_RIGHT_BRACKET_PLACEHOLDER).join(']')
}

function renderXyChartWithDoodles(source: string, theme: ThemeTokens): string {
  const spec = importMermaidXyChartDiagram(source)
  return renderChartSvg(spec, { theme: themeWithAccent(theme) })
}

function renderSequenceDiagramWithDoodles(source: string, theme: ThemeTokens): string {
  const base: Diagram = {
    id: 'ax-doodle-sequence',
    type: ElementType.SequenceDiagram,
    display: defaultDiagramDisplay,
  }
  const diagram = importMermaidSequenceWithLayout(base, source)
  return renderSequenceSvg(diagram, { theme: themeWithAccent(theme) })
}

// Pulls accent + surface from the active axonize theme so lifeline heads and
// activation bars match the host palette — gives sequence diagrams the same
// "outlined header on a tinted fill" look the legacy mermaid renderer ships
// with. Falls back to the neutral doodles defaults when the active theme is
// unreadable for some reason.
function themeWithAccent(base: ThemeTokens): ThemeTokens {
  const active = safeActiveTheme()
  if (!active) return base
  // accentFill stays unset so the doodles renderer falls through to its
  // "tint the accent stroke at low opacity" path — that reads cleanly on both
  // light and dark canvases. Passing bgSurface here produced opaque dark
  // boxes on light themes (where bgSurface is a distinct dark surface color
  // rather than a near-canvas tint).
  return {
    ...base,
    colors: {
      ...base.colors,
      accentStroke: active.colors.accent,
      accentText: active.colors.textPrimary,
    },
  }
}

function safeActiveTheme(): ReturnType<typeof getActiveTheme> | null {
  try {
    return getActiveTheme()
  } catch {
    return null
  }
}

async function renderClassDiagramWithDoodles(source: string, theme: ThemeTokens): Promise<string> {
  const base: Diagram = {
    id: 'ax-doodle-class',
    type: ElementType.ClassDiagram,
    display: defaultDiagramDisplay,
  }
  const imported = await importMermaidStructureDiagram(base, source)
  return renderClassDiagramSvg(imported as StructureDiagram, theme)
}

function renderClassDiagramSvg(diagram: StructureDiagram, theme: ThemeTokens): string {
  const width = Math.max(MIN_VIEWBOX_WIDTH, diagram.display.width)
  const height = Math.max(MIN_VIEWBOX_HEIGHT, diagram.display.height)
  const viewBox = `${-SVG_PADDING} ${-SVG_PADDING} ${width + SVG_PADDING * 2} ${height + SVG_PADDING * 2}`

  const clusterLayer = renderClusterLayer(diagram, theme)
  const nodeLayer = renderClassNodeLayer(diagram, theme)
  const edgeLayer = renderEdgeLayer(diagram, theme)
  const background = renderBackground(width, height, theme)
  const arrowMarker = renderArrowMarker(theme)

  return `<svg xmlns="http://www.w3.org/2000/svg" class="doodles-svg doodles-svg-class" viewBox="${viewBox}" width="${width + SVG_PADDING * 2}" height="${height + SVG_PADDING * 2}">${background}${arrowMarker}${clusterLayer}${nodeLayer}${edgeLayer}</svg>`
}

function renderBackground(width: number, height: number, theme: ThemeTokens): string {
  if (theme.colors.background === 'transparent') {
    return ''
  }
  return `<rect x="${-SVG_PADDING}" y="${-SVG_PADDING}" width="${width + SVG_PADDING * 2}" height="${height + SVG_PADDING * 2}" fill="${escapeXml(theme.colors.background)}" />`
}

function renderArrowMarker(theme: ThemeTokens): string {
  const edgeColor = escapeXml(theme.colors.edgeStroke)
  return `<defs><marker id="doodles-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${edgeColor}" /></marker></defs>`
}

function renderClusterLayer(diagram: StructureDiagram, theme: ThemeTokens): string {
  const parts: string[] = []
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.Cluster) {
      continue
    }
    const bounds = diagram.nodes[element.id]?.bounds
    if (!isValidBounds(bounds)) {
      continue
    }
    parts.push(renderCluster(element, bounds, theme))
  }
  return parts.join('')
}

function renderCluster(element: DiagramElement, bounds: DiagramBounds, theme: ThemeTokens): string {
  const fill = fillAttributes(theme.colors.compoundFill, CLUSTER_NEUTRAL_FILL_OPACITY)
  const stroke = escapeXml(theme.colors.compoundStroke)
  const rect = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${CLUSTER_CORNER_RADIUS}" ${fill} stroke="${stroke}" />`

  const label = normalizeText(element.text)
  if (!label) {
    return rect
  }

  const header = theme.colors.compoundFill === 'transparent'
    ? `<path d="${topRoundedRectPath(bounds.x, bounds.y, bounds.width, CLUSTER_LABEL_HEIGHT, CLUSTER_CORNER_RADIUS)}" fill="currentColor" fill-opacity="${CLUSTER_HEADER_NEUTRAL_FILL_OPACITY}" />`
    : ''
  const centerX = bounds.x + bounds.width / 2
  const labelY = bounds.y + CLUSTER_LABEL_HEIGHT / 2 + EDGE_LABEL_VERTICAL_OFFSET
  const labelText = `<text x="${centerX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(theme.font.family)}" font-size="${theme.font.size}" font-weight="bold" fill="${escapeXml(theme.colors.compoundLabel)}">${escapeXml(label)}</text>`
  return `${rect}${header}${labelText}`
}

function renderClassNodeLayer(diagram: StructureDiagram, theme: ThemeTokens): string {
  const parts: string[] = []
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.ClassNode) {
      continue
    }
    const bounds = diagram.nodes[element.id]?.bounds
    if (!isValidBounds(bounds)) {
      continue
    }
    parts.push(renderClassNode(element, bounds, theme))
  }
  return parts.join('')
}

function renderClassNode(element: DiagramElement, bounds: DiagramBounds, theme: ThemeTokens): string {
  const color = resolveNodeColors(element, theme)
  const title = normalizeText(element.text)
  const annotation = normalizeText(element.classAnnotation)
  const members = normalizeMembers(element.classMembers)
  const fields = members.filter((member) => member.kind === 'field').map((member) => member.text)
  const methods = members.filter((member) => member.kind === 'method').map((member) => member.text)

  const sections = classNodeSectionsLayout({
    classAnnotation: annotation || undefined,
    classMembers: members
  } as never, bounds.height)
  const separatorTop = bounds.y + sections.headerHeight
  const methodsTop = bounds.y + sections.methodsTop

  const fill = fillAttributes(color.fillColor, NODE_NEUTRAL_FILL_OPACITY)
  const stroke = escapeXml(color.strokeColor)
  const textColor = escapeXml(color.textColor)
  const rect = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${NODE_CORNER_RADIUS}" ${fill} stroke="${stroke}" stroke-width="${NODE_STROKE_WIDTH}" />`

  const headerDivider = sections.hasMembers
    ? `<line x1="${bounds.x}" y1="${separatorTop}" x2="${bounds.x + bounds.width}" y2="${separatorTop}" stroke="${stroke}" stroke-width="${CLASS_SECTION_DIVIDER_STROKE_WIDTH}" />`
    : ''

  let dividerMiddle = ''
  if (fields.length > 0 && methods.length > 0) {
    const middleY = separatorTop + sections.fieldsHeight
    dividerMiddle = `<line x1="${bounds.x}" y1="${middleY}" x2="${bounds.x + bounds.width}" y2="${middleY}" stroke="${stroke}" stroke-width="${CLASS_SECTION_DIVIDER_STROKE_WIDTH}" />`
  }

  const headerText = renderHeaderText(bounds, title, annotation, theme, textColor, sections.headerHeight)
  const fieldsText = renderSectionText(bounds, separatorTop, fields, theme, textColor, sections.fieldsHeight)
  const methodsText = renderSectionText(bounds, methodsTop, methods, theme, textColor, sections.methodsHeight)

  return `${rect}${headerDivider}${dividerMiddle}${headerText}${fieldsText}${methodsText}`
}

function renderHeaderText(
  bounds: DiagramBounds,
  title: string,
  annotation: string | undefined,
  theme: ThemeTokens,
  textColor: string,
  headerHeight: number
): string {
  const boxTop = bounds.y + classNodeHeaderTextInsets.top
  const boxHeight = Math.max(0, headerHeight - classNodeHeaderTextInsets.vertical)
  if (boxHeight <= 0) {
    return ''
  }
  const centerX = bounds.x + bounds.width / 2
  const centerY = boxTop + boxHeight / 2
  const fontFamily = escapeXml(theme.font.family)

  if (!annotation) {
    return `<text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="${theme.font.size}" font-weight="bold" fill="${textColor}">${escapeXml(title)}</text>`
  }

  const annotationSize = Math.max(1, classNodeMemberFontSize)
  const annotationLineHeight = classNodeMemberLineHeight
  const lineBlockHeight = annotationSize + annotationLineHeight
  const blockTop = boxTop + Math.max(0, (boxHeight - lineBlockHeight) / 2)
  const annotationY = blockTop + annotationSize
  const titleY = annotationY + annotationLineHeight
  const annotationLine = `<text x="${centerX}" y="${annotationY}" text-anchor="middle" font-family="${fontFamily}" font-size="${annotationSize}" font-style="italic" fill="${textColor}">${escapeXml(`<<${annotation}>>`)}</text>`
  const titleLine = `<text x="${centerX}" y="${titleY}" text-anchor="middle" font-family="${fontFamily}" font-size="${annotationSize}" font-weight="bold" fill="${textColor}">${escapeXml(title)}</text>`
  return `${annotationLine}${titleLine}`
}

function renderSectionText(
  bounds: DiagramBounds,
  sectionTopY: number,
  lines: string[],
  theme: ThemeTokens,
  textColor: string,
  sectionHeight: number
): string {
  if (lines.length === 0) {
    return ''
  }
  const x = bounds.x + classNodeMemberTextInsets.left
  const y = sectionTopY + classNodeMemberTextInsets.top
  const width = Math.max(0, bounds.width - classNodeMemberTextInsets.horizontal)
  const height = Math.max(0, sectionHeight - classNodeMemberTextInsets.vertical)
  if (width <= 0 || height <= 0) {
    return ''
  }
  const lineCount = Math.floor((height + classNodeMemberLineHeight - classNodeMemberFontSize) / classNodeMemberLineHeight)
  const visibleLines = lines.slice(0, Math.max(0, lineCount))
  if (visibleLines.length === 0) {
    return ''
  }
  const baseY = y + classNodeMemberFontSize
  const fontFamily = escapeXml(theme.font.family)
  const parts = visibleLines.map((line, index) => {
    const lineY = baseY + index * classNodeMemberLineHeight
    return `<text x="${x}" y="${lineY}" text-anchor="start" font-family="${fontFamily}" font-size="${classNodeMemberFontSize}" font-weight="${CLASS_SECTION_TEXT_WEIGHT}" fill="${textColor}">${escapeXml(line)}</text>`
  })
  return parts.join('')
}

function renderEdgeLayer(diagram: StructureDiagram, theme: ThemeTokens): string {
  const routes = routeEdges(diagram as never, theme)
  const parts = routes.map((route) => renderEdge(route, theme))
  return parts.join('')
}

function renderEdge(route: EdgeRoute, theme: ThemeTokens): string {
  const pathData = polylinePath(route)
  if (!pathData) {
    return ''
  }

  const edgeStroke = escapeXml(theme.colors.edgeStroke)
  const path = `<path d="${pathData}" fill="none" stroke="${edgeStroke}" stroke-width="${EDGE_STROKE_WIDTH}" marker-end="url(#doodles-arrow)" />`
  if (!route.label || !route.labelBox) {
    return path
  }

  const labelX = route.labelBox.x + route.labelBox.width / 2
  const labelY = route.labelBox.y + route.labelBox.height / 2 + EDGE_LABEL_VERTICAL_OFFSET
  const labelText = escapeXml(normalizeText(route.label))
  const labelColor = escapeXml(theme.colors.edgeText)
  const haloColor = 'var(--doodles-label-halo, currentColor)'
  const halo = `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="${escapeXml(theme.font.family)}" font-size="${EDGE_LABEL_FONT_SIZE}" fill="none" stroke="${haloColor}" stroke-width="${EDGE_LABEL_HALO_STROKE_WIDTH}" paint-order="stroke">${labelText}</text>`
  const text = `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="${escapeXml(theme.font.family)}" font-size="${EDGE_LABEL_FONT_SIZE}" fill="${labelColor}">${labelText}</text>`
  return `${path}${halo}${text}`
}

function polylinePath(route: EdgeRoute): string {
  if (route.polyline.length === 0) {
    return ''
  }
  const [head, ...tail] = route.polyline
  const commands = tail.map((point) => `L ${point.x} ${point.y}`).join(' ')
  return commands ? `M ${head.x} ${head.y} ${commands}` : `M ${head.x} ${head.y}`
}

function resolveNodeColors(element: DiagramElement, theme: ThemeTokens): {
  fillColor: string
  strokeColor: string
  textColor: string
} {
  const fillColor = element.colorSchema?.fillColor ?? theme.colors.nodeFill
  const strokeColor = element.colorSchema?.strokeColor ?? theme.colors.nodeStroke
  const textColor = element.colorSchema?.textColor ?? theme.colors.nodeText
  return { fillColor, strokeColor, textColor }
}

function normalizeMembers(members: DiagramClassMember[] | undefined): DiagramClassMember[] {
  if (!members || members.length === 0) {
    return []
  }
  return members
    .map((member) => ({
      kind: member.kind,
      text: normalizeText(member.text)
    }))
    .filter((member) => member.text.length > 0)
}

function normalizeText(value: string | undefined): string {
  if (!value) {
    return ''
  }
  return value.trim().replace(WHITE_SPACE_RE, ' ')
}

function fillAttributes(fillColor: string, neutralOpacity: number): string {
  if (fillColor === 'transparent') {
    return `fill="currentColor" fill-opacity="${neutralOpacity}"`
  }
  return `fill="${escapeXml(fillColor)}"`
}

function topRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  return `M${x + radius},${y} L${x + width - radius},${y} Q${x + width},${y} ${x + width},${y + radius} L${x + width},${y + height} L${x},${y + height} L${x},${y + radius} Q${x},${y} ${x + radius},${y} Z`
}

function isValidBounds(bounds: DiagramBounds | undefined): bounds is DiagramBounds {
  return !!bounds &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
