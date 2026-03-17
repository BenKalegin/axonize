import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, Content } from 'mdast'

export interface MarkdownSection {
  id: string
  kind: 'preamble' | 'heading' | 'mermaid'
  depth: number
  title: string
  startLine: number
  endLine: number
  rawMarkdown: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

const MERMAID_LANG = 'mermaid'

interface RawGroup {
  kind: 'preamble' | 'heading' | 'mermaid'
  depth: number
  title: string
  startLine: number
  endLine: number
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
    } else if (current.kind !== 'mermaid') {
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
