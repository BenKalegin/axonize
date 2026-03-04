import type { RelationType, Facet } from '../../../core/semantic/types'

export const CARD_WIDTH = 240
export const CARD_HEIGHT = 110
export const HUB_RADIUS = 28
export const CLUSTER_WIDTH = 300
export const CLUSTER_BASE_HEIGHT = 80
export const CLUSTER_DOC_LINE_HEIGHT = 16

const RELATION_COLORS: Record<string, string> = {
  sequence: '#89b4fa',
  elaboration: '#a6e3a1',
  inference: '#f9e2af',
  contrast: '#f38ba8',
  example: '#cba6f7',
  dependency: '#fab387',
  competes_with: '#f38ba8',
  implements: '#89b4fa',
  specifies: '#cba6f7',
  extends: '#a6e3a1',
  uses: '#fab387'
}

const DIMENSION_PALETTE = [
  '#89b4fa', '#a6e3a1', '#f9e2af', '#cba6f7', '#f38ba8',
  '#fab387', '#94e2d5', '#f2cdcd', '#89dceb', '#eba0ac'
]

function colorForIndex(index: number): string {
  return DIMENSION_PALETTE[index % DIMENSION_PALETTE.length]
}

const LEVEL_0_ACCENT = '#89b4fa'
const HOVER_BORDER = '#b4befe'
const DEFAULT_BORDER = '#45475a'

// --- Shared drawing helpers ---

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  let linesDrawn = 0

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
      linesDrawn++
      if (linesDrawn >= maxLines) return
    } else {
      line = testLine
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY)
  }
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text
}

function selectBorder(level: number, isHovered: boolean): string {
  if (isHovered) return HOVER_BORDER
  if (level === 0) return LEVEL_0_ACCENT
  return DEFAULT_BORDER
}

// --- Doc / Section / Detail Card ---

export function drawCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  summary: string,
  x: number,
  y: number,
  scale: number,
  opacity: number,
  level: number,
  isHovered: boolean
): void {
  if (opacity <= 0 || scale <= 0) return

  const w = CARD_WIDTH * scale
  const h = CARD_HEIGHT * scale

  ctx.save()
  ctx.globalAlpha = opacity

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 8 * scale
  ctx.shadowOffsetY = 2 * scale

  // Background
  ctx.fillStyle = '#313244'
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 8 * scale)
  ctx.fill()

  // Reset shadow before border
  ctx.shadowColor = 'transparent'

  // Border
  ctx.strokeStyle = selectBorder(level, isHovered)
  ctx.lineWidth = (isHovered ? 2 : 1) * scale
  ctx.stroke()

  // Title
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#cdd6f4'
  ctx.font = `bold ${Math.max(10, 14 * scale)}px sans-serif`
  ctx.fillText(truncate(title, 38), x, y - h / 4)

  // Summary
  ctx.fillStyle = '#a6adc8'
  ctx.font = `${Math.max(9, 12 * scale)}px sans-serif`
  wrapText(ctx, summary, x, y + 6 * scale, w - 20 * scale, 14 * scale, 3)

  ctx.restore()
}

// --- Hub Node ---

export function drawHubNode(
  ctx: CanvasRenderingContext2D,
  title: string,
  dimensionIndex: number,
  x: number,
  y: number,
  opacity: number,
  isHovered: boolean
): void {
  if (opacity <= 0) return

  const r = HUB_RADIUS
  const color = colorForIndex(dimensionIndex)

  ctx.save()
  ctx.globalAlpha = opacity

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 1

  // Circle
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.fillStyle = isHovered ? '#45475a' : '#313244'
  ctx.fill()
  ctx.shadowColor = 'transparent'

  ctx.strokeStyle = isHovered ? HOVER_BORDER : color
  ctx.lineWidth = isHovered ? 2.5 : 2
  ctx.stroke()

  // Inner dot
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, 2 * Math.PI)
  ctx.fillStyle = color
  ctx.fill()

  // Title below
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#a6adc8'
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText(truncate(title, 20), x, y + r + 6)

  ctx.restore()
}

// --- Cluster Card ---

export function clusterCardHeight(docCount: number): number {
  const docLines = Math.min(docCount, 5)
  return CLUSTER_BASE_HEIGHT + docLines * CLUSTER_DOC_LINE_HEIGHT
}

export function drawClusterCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  summary: string,
  x: number,
  y: number,
  opacity: number,
  isHovered: boolean,
  docTitles?: string[]
): void {
  if (opacity <= 0) return

  const docs = docTitles ?? []
  const w = CLUSTER_WIDTH
  const h = clusterCardHeight(docs.length)

  ctx.save()
  ctx.globalAlpha = opacity

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2

  // Background
  ctx.fillStyle = '#1e1e2e'
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 10)
  ctx.fill()

  ctx.shadowColor = 'transparent'

  // Dashed border
  ctx.setLineDash([8, 4])
  ctx.strokeStyle = isHovered ? HOVER_BORDER : '#585b70'
  ctx.lineWidth = isHovered ? 2 : 1.5
  ctx.stroke()
  ctx.setLineDash([])

  // Title
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#cdd6f4'
  ctx.font = 'bold 13px sans-serif'
  const topY = y - h / 2
  ctx.fillText(truncate(title, 40), x, topY + 18)

  // Summary
  ctx.fillStyle = '#6c7086'
  ctx.font = '11px sans-serif'
  wrapText(ctx, summary, x, topY + 36, w - 24, 13, 2)

  // Doc titles as bullet list
  if (docs.length > 0) {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#a6adc8'
    ctx.font = '10px sans-serif'
    const listX = x - w / 2 + 20
    let listY = topY + 58
    const maxDocs = Math.min(docs.length, 5)
    for (let i = 0; i < maxDocs; i++) {
      ctx.fillText(`\u2022 ${truncate(docs[i], 45)}`, listX, listY)
      listY += CLUSTER_DOC_LINE_HEIGHT
    }
    if (docs.length > 5) {
      ctx.fillStyle = '#585b70'
      ctx.fillText(`  +${docs.length - 5} more`, listX, listY)
    }
  }

  ctx.restore()
}

// --- Facet Badges ---

export function drawFacetBadges(
  ctx: CanvasRenderingContext2D,
  facets: Facet,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number
): void {
  if (scale < 0.6) return

  const dotR = 3 * scale
  const gap = 8 * scale
  const keys = Object.keys(facets).filter((k) => k !== 'topics' && facets[k].length > 0)
  if (keys.length === 0) return

  const totalWidth = keys.length * dotR * 2 + (keys.length - 1) * gap
  let dotX = x - totalWidth / 2 + dotR
  const dotY = y + h / 2 - dotR - 4 * scale

  ctx.save()
  ctx.globalAlpha = 0.8

  for (let i = 0; i < keys.length; i++) {
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotR, 0, 2 * Math.PI)
    ctx.fillStyle = colorForIndex(i)
    ctx.fill()
    dotX += dotR * 2 + gap
  }

  ctx.restore()
}

// --- Relation Edge ---

function computeCurveControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number
): { cx: number; cy: number } {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  return {
    cx: mx + dy * curvature,
    cy: my - dx * curvature
  }
}

export function drawRelationEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: RelationType | string,
  opacity: number
): void {
  if (opacity <= 0) return

  ctx.save()
  ctx.globalAlpha = opacity * 0.6
  ctx.strokeStyle = RELATION_COLORS[type] ?? '#585b70'
  ctx.lineWidth = 1.5

  const isDashed = type === 'elaboration' || type === 'example'
  const isZigzag = type === 'contrast'

  if (isDashed) {
    ctx.setLineDash([6, 4])
  } else if (isZigzag) {
    ctx.setLineDash([3, 3])
  }

  const { cx, cy } = computeCurveControlPoint(x1, y1, x2, y2, 0.15)

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(cx, cy, x2, y2)
  ctx.stroke()

  if (type === 'sequence' || type === 'dependency' || type === 'implements' || type === 'specifies') {
    drawArrowHead(ctx, cx, cy, x2, y2, 8)
  }

  ctx.setLineDash([])
  ctx.restore()
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - size * Math.cos(angle - Math.PI / 6),
    y2 - size * Math.sin(angle - Math.PI / 6)
  )
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - size * Math.cos(angle + Math.PI / 6),
    y2 - size * Math.sin(angle + Math.PI / 6)
  )
  ctx.stroke()
}
