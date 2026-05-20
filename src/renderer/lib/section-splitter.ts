import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, Content } from 'mdast'

export interface MarkdownSection {
  id: string
  kind: 'preamble' | 'heading' | 'mermaid' | 'table'
  depth: number
  title: string
  startLine: number
  endLine: number
  rawMarkdown: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

const MERMAID_LANG = 'mermaid'
const TABLE_SECTION_TITLE = 'Table'

interface RawGroup {
  kind: 'preamble' | 'heading' | 'mermaid' | 'table'
  depth: number
  title: string
  startLine: number
  endLine: number
}

// Atomic groups represent a single AST node and never absorb following siblings.
function isAtomicKind(kind: RawGroup['kind']): boolean {
  return kind === 'mermaid' || kind === 'table'
}

function nodeStartLine(node: Content): number {
  return node.position?.start.line ?? 1
}

function nodeEndLine(node: Content): number {
  return node.position?.end.line ?? 1
}

function isMermaidCodeBlock(node: Content): boolean {
  return node.type === 'code' && (node as { lang?: string }).lang === MERMAID_LANG
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
    if (isMermaidCodeBlock(node)) {
      groups.push({
        kind: 'mermaid',
        depth: 0,
        title: 'Diagram',
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
