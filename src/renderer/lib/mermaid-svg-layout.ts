export interface MermaidNodePosition {
  x: number
  y: number
  width: number
  height: number
  label?: string
}

const MERMAID_NODE_ID_RE = /^(?:flowchart|class)-(.+?)-\d+$/

/**
 * Parse a mermaid-rendered SVG and return the absolute top-left coordinates
 * (and dimensions) for every flowchart node, keyed by the original mermaid
 * identifier (the value of `data-id`, with fallback to the prefixed `id`
 * attribute used by older mermaid releases).
 */
export function extractMermaidLayoutFromSvg(svg: string): Map<string, MermaidNodePosition> {
  const positions = new Map<string, MermaidNodePosition>()
  if (!svg) return positions

  const doc = new DOMParser().parseFromString(`<div>${svg}</div>`, 'text/html')

  for (const node of Array.from(doc.querySelectorAll('g.node'))) {
    const id = readNodeId(node)
    if (!id || positions.has(id)) continue
    const center = readTransformTranslate(node.getAttribute('transform'))
    if (!center) continue
    const size = readNodeSize(node)
    const label = readNodeLabel(node)
    positions.set(id, {
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
      width: size.width,
      height: size.height,
      label
    })
  }

  return positions
}

function readNodeId(node: Element): string | null {
  const dataId = node.getAttribute('data-id')
  if (dataId) return dataId
  const idAttr = node.getAttribute('id') ?? ''
  const match = idAttr.match(MERMAID_NODE_ID_RE)
  return match ? match[1] : null
}

function readTransformTranslate(transform: string | null): { x: number; y: number } | null {
  if (!transform) return null
  const match = transform.match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/)
  if (!match) return null
  const x = Number(match[1])
  const y = Number(match[2])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

const FALLBACK_NODE_WIDTH = 140
const FALLBACK_NODE_HEIGHT = 60

function readNodeLabel(node: Element): string | undefined {
  const labelEl = node.querySelector('g.label')
  const text = labelEl?.textContent?.trim()
  return text || undefined
}

function readNodeSize(node: Element): { width: number; height: number } {
  const rect = node.querySelector('rect')
  if (rect) {
    const w = Number(rect.getAttribute('width'))
    const h = Number(rect.getAttribute('height'))
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h }
    }
  }
  return { width: FALLBACK_NODE_WIDTH, height: FALLBACK_NODE_HEIGHT }
}
