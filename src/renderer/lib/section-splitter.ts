import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, Content } from 'mdast'

export type SectionKind = 'preamble' | 'heading' | 'mermaid' | 'table' | 'bpmn' | 'html'

export interface MarkdownSection {
  id: string
  kind: SectionKind
  depth: number
  title: string
  startLine: number
  endLine: number
  rawMarkdown: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

const TABLE_SECTION_TITLE = 'Table'

// Fenced code blocks whose language promotes them to their own atomic island.
const FENCED_ISLANDS: ReadonlyArray<{ lang: string; kind: SectionKind; title: string }> = [
  { lang: 'mermaid', kind: 'mermaid', title: 'Diagram' },
  { lang: 'bpmn', kind: 'bpmn', title: 'BPMN' },
  { lang: 'html', kind: 'html', title: 'HTML' }
]

interface RawGroup {
  kind: SectionKind
  depth: number
  title: string
  startLine: number
  endLine: number
}

// Atomic groups represent a single AST node and never absorb following siblings.
function isAtomicKind(kind: RawGroup['kind']): boolean {
  return kind === 'table' || FENCED_ISLANDS.some((island) => island.kind === kind)
}

function nodeStartLine(node: Content): number {
  return node.position?.start.line ?? 1
}

function nodeEndLine(node: Content): number {
  return node.position?.end.line ?? 1
}

function fencedIsland(node: Content): { kind: SectionKind; title: string } | null {
  if (node.type !== 'code') return null
  const lang = (node as { lang?: string }).lang
  return FENCED_ISLANDS.find((island) => island.lang === lang) ?? null
}

function isTableNode(node: Content): boolean {
  return node.type === 'table'
}

function headingText(node: Content): string {
  if (node.type !== 'heading') return ''
  return (node as { children: Array<{ value?: string }> }).children
    .map((c) => c.value ?? '')
    .join('')
}

function groupAstNodes(children: Content[]): RawGroup[] {
  const groups: RawGroup[] = []
  let current: RawGroup | null = null

  for (const node of children) {
    const island = fencedIsland(node)
    if (island) {
      groups.push({
        kind: island.kind,
        depth: 0,
        title: island.title,
        startLine: nodeStartLine(node),
        endLine: nodeEndLine(node)
      })
      current = null
      continue
    }

    if (isTableNode(node)) {
      groups.push({
        kind: 'table',
        depth: 0,
        title: TABLE_SECTION_TITLE,
        startLine: nodeStartLine(node),
        endLine: nodeEndLine(node)
      })
      current = null
      continue
    }

    if (node.type === 'heading') {
      current = {
        kind: 'heading',
        depth: (node as { depth: number }).depth,
        title: headingText(node),
        startLine: nodeStartLine(node),
        endLine: nodeEndLine(node)
      }
      groups.push(current)
      continue
    }

    if (!current) {
      current = {
        kind: 'preamble',
        depth: 0,
        title: '',
        startLine: nodeStartLine(node),
        endLine: nodeEndLine(node)
      }
      groups.push(current)
    } else if (!isAtomicKind(current.kind)) {
      current.endLine = nodeEndLine(node)
    }
  }

  return groups
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join('\n')
}

export function splitSections(markdown: string): MarkdownSection[] {
  const ast = parser.parse(markdown) as Root
  const lines = markdown.split('\n')

  if (ast.children.length === 0) {
    return [
      {
        id: 'section-1-' + lines.length,
        kind: 'preamble',
        depth: 0,
        title: '',
        startLine: 1,
        endLine: lines.length,
        rawMarkdown: markdown
      }
    ]
  }

  const groups = groupAstNodes(ast.children)

  return groups.map((g) => ({
    id: `section-${g.startLine}-${g.endLine}`,
    kind: g.kind,
    depth: g.depth,
    title: g.title,
    startLine: g.startLine,
    endLine: g.endLine,
    rawMarkdown: sliceLines(lines, g.startLine, g.endLine)
  }))
}
