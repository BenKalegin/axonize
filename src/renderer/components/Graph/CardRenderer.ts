import type { RelationType } from '../../../core/semantic/types'

const RELATION_COLORS: Record<string, string> = {
  sequence: '#89b4fa',
  elaboration: '#a6e3a1',
  inference: '#f9e2af',
  contrast: '#f38ba8',
  example: '#cba6f7',
  dependency: '#fab387'
}

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
  ctx.fill()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
      if (currentY > y + lineHeight * 2) break
    } else {
      line = testLine
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY)
  }
}

export function drawCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  summary: string,
  x: number,
  y: number,
  scale: number,
  opacity: number
): void {
  if (opacity <= 0 || scale <= 0) return

  const w = 180 * scale
  const h = 80 * scale

  ctx.save()
  ctx.globalAlpha = opacity

  // Background
  ctx.fillStyle = '#313244'
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 8 * scale)

  // Border
  ctx.strokeStyle = '#45475a'
  ctx.lineWidth = 1 * scale
  ctx.stroke()

  // Title
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#cdd6f4'
  ctx.font = `bold ${Math.max(8, 12 * scale)}px sans-serif`
  ctx.fillText(truncate(title, 24), x, y - h / 4)

  // Summary
  ctx.fillStyle = '#a6adc8'
  ctx.font = `${Math.max(6, 10 * scale)}px sans-serif`
  wrapText(ctx, summary, x, y + 4 * scale, w - 16 * scale, 12 * scale)

  ctx.restore()
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

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  // Arrow for sequence and dependency
  if (type === 'sequence' || type === 'dependency') {
    drawArrowHead(ctx, x1, y1, x2, y2, 8)
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

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text
}
