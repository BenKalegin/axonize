export interface MermaidVisualNode {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  locked?: boolean
}

export interface MermaidVisualEdge {
  from: string
  to: string
  label?: string
}

export interface MermaidVisualModel {
  supported: boolean
  source: string
  body: string
  nodes: MermaidVisualNode[]
  edges: MermaidVisualEdge[]
}

interface MermaidSourceParts {
  before: string
  source: string
  after: string
}

const DEFAULT_NODE_WIDTH = 170
const DEFAULT_NODE_HEIGHT = 76
const GRID_START_X = 80
const GRID_START_Y = 100
const GRID_GAP_X = 260
const GRID_GAP_Y = 170

export function isMermaidSection(markdown: string): boolean {
  return /^\s*```mermaid\b/i.test(markdown)
}

export function parseMermaidVisualModel(markdown: string): MermaidVisualModel {
  const parts = extractMermaidSource(markdown)
  const source = parts?.source ?? markdown
  const { frontmatter, body } = splitFrontmatter(source)
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean)
  const header = lines.find((line) => line.toLowerCase().startsWith('classdiagram'))

  if (!header) {
    return {
      supported: false,
      source,
      body,
      nodes: [],
      edges: []
    }
  }

  const declared = new Set<string>()
  const edges: MermaidVisualEdge[] = []

  for (const line of lines) {
    if (line.toLowerCase().startsWith('classdiagram')) continue
    if (line.toLowerCase().startsWith('direction ')) continue
    if (line.startsWith('%%')) continue

    const classMatch = line.match(/^class\s+([A-Za-z_][\w-]*)/)
    if (classMatch) {
      declared.add(classMatch[1])
      continue
    }

    const relMatch = line.match(/^([A-Za-z_][\w-]*)\s+(?:<\|--|-->|--|--\*|--o|\.\.>|<--|<->)\s+([A-Za-z_][\w-]*)(?:\s*:\s*(.*))?$/)
    if (relMatch) {
      declared.add(relMatch[1])
      declared.add(relMatch[2])
      edges.push({
        from: relMatch[1],
        to: relMatch[2],
        label: relMatch[3]?.trim()
      })
    }
  }

  const layout = parseAxonizeNodeLayout(frontmatter)
  const ids = Array.from(declared)
  const nodes = ids.map((id, index) => {
    const saved = layout[id]
    const col = index % 3
    const row = Math.floor(index / 3)
    return {
      id,
      label: id,
      x: saved?.x ?? GRID_START_X + col * GRID_GAP_X,
      y: saved?.y ?? GRID_START_Y + row * GRID_GAP_Y,
      width: saved?.width ?? DEFAULT_NODE_WIDTH,
      height: saved?.height ?? DEFAULT_NODE_HEIGHT,
      locked: saved?.locked
    }
  })

  return {
    supported: nodes.length > 0,
    source,
    body,
    nodes,
    edges
  }
}

export function updateMermaidLayout(markdown: string, nodes: MermaidVisualNode[]): string {
  const parts = extractMermaidSource(markdown)
  if (!parts) return markdown

  const { frontmatter, body } = splitFrontmatter(parts.source)
  const nextFrontmatter = mergeAxonizeLayoutNodes(frontmatter, nodes)

  const nextSource = `---\n${nextFrontmatter}\n---\n${body.trimStart()}`
  return `${parts.before}${nextSource}${parts.after}`
}

function extractMermaidSource(markdown: string): MermaidSourceParts | null {
  const match = markdown.match(/^(\s*```mermaid[^\n]*\n)([\s\S]*?)(\n```\s*)$/i)
  if (!match) return null
  return {
    before: match[1],
    source: match[2],
    after: match[3]
  }
}

function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const normalized = source.replace(/\r\n/g, '\n').trimStart()
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: '', body: source }
  }

  const closing = normalized.indexOf('\n---\n', 4)
  if (closing < 0) {
    return { frontmatter: '', body: source }
  }

  return {
    frontmatter: normalized.slice(4, closing),
    body: normalized.slice(closing + 5)
  }
}

function parseAxonizeNodeLayout(frontmatter: string): Record<string, Partial<MermaidVisualNode>> {
  const result: Record<string, Partial<MermaidVisualNode>> = {}
  const lines = frontmatter.split('\n')
  const nodesLineIndex = lines.findIndex((line) => /^\s{4}nodes:\s*$/.test(line))
  if (nodesLineIndex < 0) return result

  for (let index = nodesLineIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (/^\s{0,4}\S/.test(line)) break

    const inline = line.match(/^\s{6,}("?[^":]+"?|[A-Za-z_][\w-]*):\s*\{([^}]*)\}\s*$/)
    if (inline) {
      result[unquote(inline[1].trim())] = parseInlineLayout(inline[2])
      continue
    }

    const nested = line.match(/^\s{6,}("?[^":]+"?|[A-Za-z_][\w-]*):\s*$/)
    if (nested) {
      const key = unquote(nested[1].trim())
      result[key] = {}
      for (let nestedIndex = index + 1; nestedIndex < lines.length; nestedIndex++) {
        const nestedLine = lines[nestedIndex]
        if (!/^\s{8,}\S/.test(nestedLine)) break
        const prop = nestedLine.match(/^\s+([A-Za-z_][\w-]*):\s*(.+?)\s*$/)
        if (prop) {
          applyLayoutProperty(result[key], prop[1], prop[2])
        }
        index = nestedIndex
      }
    }
  }

  return result
}

function parseInlineLayout(content: string): Partial<MermaidVisualNode> {
  return content.split(',').reduce<Partial<MermaidVisualNode>>((acc, part) => {
    const [rawKey, ...rawValueParts] = part.split(':')
    if (!rawKey || rawValueParts.length === 0) return acc
    applyLayoutProperty(acc, rawKey.trim(), rawValueParts.join(':').trim())
    return acc
  }, {})
}

function applyLayoutProperty(target: Partial<MermaidVisualNode>, key: string, rawValue: string): void {
  const value = rawValue.trim()
  if (key === 'locked') {
    target.locked = value === 'true'
    return
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return

  if (key === 'x') target.x = numeric
  if (key === 'y') target.y = numeric
  if (key === 'width') target.width = numeric
  if (key === 'height') target.height = numeric
}

function mergeAxonizeLayoutNodes(frontmatter: string, nodes: MermaidVisualNode[]): string {
  const lines = frontmatter.split('\n')
  const xIndex = lines.findIndex((line) => /^x-axonize:\s*/.test(line))
  const nodeLines = ['    nodes:', ...stringifyAxonizeNodeLines(nodes)]

  if (xIndex < 0 || /^x-axonize:\s*\S/.test(lines[xIndex])) {
    const withoutInlineAxonize = xIndex >= 0
      ? lines.filter((_, index) => index !== xIndex).join('\n').trim()
      : frontmatter.trim()
    return [
      withoutInlineAxonize,
      'x-axonize:',
      '  version: 1',
      '  editor: clouddiagram',
      '  layout:',
      ...nodeLines
    ].filter(Boolean).join('\n')
  }

  const xEnd = findNextTopLevelLine(lines, xIndex + 1)
  const layoutIndex = findLineInRange(lines, xIndex + 1, xEnd, /^  layout:\s*$/)

  if (layoutIndex < 0) {
    const next = [...lines]
    next.splice(xEnd, 0, '  layout:', ...nodeLines)
    return next.join('\n').trim()
  }

  const layoutEnd = findNextLineAtIndentOrLess(lines, layoutIndex + 1, 2)
  const nodesIndex = findLineInRange(lines, layoutIndex + 1, layoutEnd, /^    nodes:\s*$/)

  const next = [...lines]
  if (nodesIndex < 0) {
    next.splice(layoutIndex + 1, 0, ...nodeLines)
  } else {
    const nodesEnd = findNextLineAtIndentOrLess(lines, nodesIndex + 1, 4)
    next.splice(nodesIndex, nodesEnd - nodesIndex, ...nodeLines)
  }

  return next.join('\n').trim()
}

function findNextTopLevelLine(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index++) {
    if (/^\S/.test(lines[index])) {
      return index
    }
  }
  return lines.length
}

function findNextLineAtIndentOrLess(lines: string[], startIndex: number, indent: number): number {
  const pattern = new RegExp(`^\\s{0,${indent}}\\S`)
  for (let index = startIndex; index < lines.length; index++) {
    if (pattern.test(lines[index])) {
      return index
    }
  }
  return lines.length
}

function findLineInRange(lines: string[], startIndex: number, endIndex: number, pattern: RegExp): number {
  for (let index = startIndex; index < endIndex; index++) {
    if (pattern.test(lines[index])) {
      return index
    }
  }
  return -1
}

function stringifyAxonizeNodeLines(nodes: MermaidVisualNode[]): string[] {
  return nodes.map((node) => {
    const values = [
      `x: ${Math.round(node.x)}`,
      `y: ${Math.round(node.y)}`,
      `width: ${Math.round(node.width)}`,
      `height: ${Math.round(node.height)}`,
      node.locked ? 'locked: true' : ''
    ].filter(Boolean)
    return `      ${formatYamlKey(node.id)}: { ${values.join(', ')} }`
  })
}

function formatYamlKey(key: string): string {
  return /^[A-Za-z_][\w-]*$/.test(key) ? key : JSON.stringify(key)
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}
