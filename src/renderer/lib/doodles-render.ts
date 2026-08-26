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
const AXONIZE_HEXAGON_SHAPE = 'hexagon'
const ROUTE_OBSTACLE_CLEARANCE_PX = 8
const PORT_RATIO_STEP = 5

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
  axonizeFlowchartShape?: typeof AXONIZE_HEXAGON_SHAPE
  port1?: string
  port2?: string
}

type DiagramNodeRecord = {
  bounds: DiagramBounds
}

type DiagramPortRecord = {
  alignment?: PortAlignment
  edgePosRatio?: number
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
  return patchUnsupportedFlowchartShapes(svg, diagram as StructureDiagram)
}

export async function importMermaidFlowchartWithAxonizeLayout(source: string): Promise<Diagram> {
  const base: Diagram = {
    id: 'ax-doodle',
    type: ElementType.FlowchartDiagram,
    display: defaultDiagramDisplay,
  }
  const { source: compatibleSource, hexagonNodeIds } = replaceHexagonNodes(source)
  const protectedSource = protectQuotedLabelClosingBrackets(compatibleSource)
  const diagram = (await importMermaidFlowchartWithLayout(base, protectedSource)) as StructureDiagram
  restoreQuotedLabelClosingBrackets(diagram)
  markHexagonNodes(diagram, hexagonNodeIds)
  avoidNodeCrossingRoutes(diagram)
  avoidSameSourceRouteCrossings(diagram)
  return diagram
}

/**
 * Doodles currently understands the common Mermaid flowchart wrappers but not
 * the hexagon form (`NODE{{label}}`). Feed the importer the equivalent process
 * wrapper so it retains the label and graph topology, while recording the
 * source ids whose outlines must be restored after SVG rendering.
 */
function replaceHexagonNodes(source: string): { source: string; hexagonNodeIds: Set<string> } {
  const hexagonNodeIds = new Set<string>()
  const lines = source.split('\n').map((line) => {
    if (line.trimStart().startsWith('%%')) return line
    return replaceHexagonNodesInLine(line, hexagonNodeIds)
  })
  return { source: lines.join('\n'), hexagonNodeIds }
}

function replaceHexagonNodesInLine(line: string, ids: Set<string>): string {
  const startRe = /(^|[^\w-])([\w-]+)(\s*)\{\{/g
  let result = ''
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = startRe.exec(line)) !== null) {
    const contentStart = startRe.lastIndex
    const contentEnd = findHexagonClose(line, contentStart)
    if (contentEnd < 0) break

    const prefixLength = match[1]!.length
    const nodeStart = match.index + prefixLength
    const id = match[2]!
    const spacing = match[3]!
    const label = line.slice(contentStart, contentEnd)

    result += line.slice(cursor, nodeStart)
    result += `${id}${spacing}[${label}]`
    ids.add(id)
    cursor = contentEnd + 2
    startRe.lastIndex = cursor
  }

  return cursor === 0 ? line : result + line.slice(cursor)
}

function findHexagonClose(line: string, start: number): number {
  let quote: '"' | '`' | undefined
  let escaped = false
  for (let index = start; index < line.length - 1; index++) {
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
    if (char === '}' && line[index + 1] === '}') return index
  }
  return -1
}

function markHexagonNodes(diagram: StructureDiagram, sourceIds: Set<string>): void {
  if (sourceIds.size === 0) return
  for (const element of Object.values(diagram.elements)) {
    if (element.type !== ElementType.ClassNode || !element.sourceId) continue
    if (sourceIds.has(element.sourceId)) {
      element.axonizeFlowchartShape = AXONIZE_HEXAGON_SHAPE
    }
  }
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

    if (!resolved && targetPort.alignment !== undefined) {
      sourcePort.edgePosRatio = originalSourceRatio
      targetPort.edgePosRatio = originalTargetRatio
      const originalTargetAlignment = targetPort.alignment
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

    if (!resolved) {
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

function patchUnsupportedFlowchartShapes(svg: string, diagram: StructureDiagram): string {
  let result = svg
  for (const element of Object.values(diagram.elements)) {
    if (element.axonizeFlowchartShape !== AXONIZE_HEXAGON_SHAPE || !element.sourceId) continue
    const bounds = diagram.nodes[element.id]?.bounds
    if (!isValidBounds(bounds)) continue
    result = replaceNodeRectWithHexagon(result, element.sourceId, bounds)
  }
  return result
}

function replaceNodeRectWithHexagon(svg: string, sourceId: string, bounds: DiagramBounds): string {
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
  const paint = Array.from(rect.matchAll(/\s(?:fill|fill-opacity|stroke|stroke-width)="[^"]*"/g))
    .map((match) => match[0])
    .join('')
  const inset = Math.min(bounds.width * 0.12, bounds.height * 0.25)
  const points = [
    `${bounds.x + inset},${bounds.y}`,
    `${bounds.x + bounds.width - inset},${bounds.y}`,
    `${bounds.x + bounds.width},${bounds.y + bounds.height / 2}`,
    `${bounds.x + bounds.width - inset},${bounds.y + bounds.height}`,
    `${bounds.x + inset},${bounds.y + bounds.height}`,
    `${bounds.x},${bounds.y + bounds.height / 2}`,
  ].join(' ')
  const polygon = `<polygon points="${points}"${paint} />`
  return svg.slice(0, rectStart) + polygon + svg.slice(rectEnd + 2)
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
