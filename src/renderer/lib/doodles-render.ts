import {
  type Diagram,
  ElementType,
  defaultDiagramDisplay,
  importMermaidStructureDiagram,
  importMermaidFlowchartWithLayout,
  renderSvg,
  routeEdges,
  type EdgeRoute,
  type ThemeTokens,
  defaultLightTheme,
  defaultDarkTheme,
} from '@benkalegin/doodles-api'
import {
  classNodeHeaderTextInsets,
  classNodeMemberFontSize,
  classNodeMemberLineHeight,
  classNodeMemberTextInsets,
  classNodeSectionsLayout,
} from '@benkalegin/doodles-core'

const FLOWCHART_LIKE = /^\s*(?:---\s*\n[\s\S]*?\n---\s*\n)?(?:flowchart|graph|classDiagram|c4context|c4container|c4component|c4dynamic|c4deployment)\b/i
const CLASS_DIAGRAM = /^\s*(?:---\s*\n[\s\S]*?\n---\s*\n)?classDiagram\b/i

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
  classAnnotation?: string
  classMembers?: DiagramClassMember[]
  colorSchema?: DiagramColorSchema
}

type DiagramNodeRecord = {
  bounds: DiagramBounds
}

type DiagramPortRecord = {
  alignment?: unknown
  edgePosRatio?: number
}

type StructureDiagram = Diagram & {
  display: DiagramDisplay
  elements: Record<string, DiagramElement>
  nodes: Record<string, DiagramNodeRecord>
  ports?: Record<string, DiagramPortRecord>
}

/**
 * True for Mermaid sources doodles 0.3.0 knows how to parse + render
 * end-to-end (flowchart / graph / classDiagram / C4 variants). Other kinds
 * (sequence, gantt, er, pie, state, mindmap, …) still go through the
 * `mermaid` library for now.
 */
export function canRenderWithDoodles(source: string): boolean {
  return FLOWCHART_LIKE.test(source)
}

/**
 * Parse + layout + render a flowchart-shaped Mermaid source as SVG via
 * `@benkalegin/doodles-api`. Returns the SVG string. Throws if the source
 * is malformed or doodles' importer rejects it.
 */
export async function renderMermaidWithDoodles(
  source: string,
  options: { dark?: boolean } = {}
): Promise<string> {
  const theme: ThemeTokens = options.dark ? defaultDarkTheme : defaultLightTheme
  if (CLASS_DIAGRAM.test(source)) {
    return renderClassDiagramWithDoodles(source, theme)
  }

  const base: Diagram = {
    id: 'ax-doodle',
    type: ElementType.FlowchartDiagram,
    display: defaultDiagramDisplay,
  }
  const diagram = await importMermaidFlowchartWithLayout(base, source)
  return renderSvg(diagram as never, { theme })
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width + SVG_PADDING * 2}" height="${height + SVG_PADDING * 2}">${background}${arrowMarker}${clusterLayer}${nodeLayer}${edgeLayer}</svg>`
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
