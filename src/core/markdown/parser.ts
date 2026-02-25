import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { Root, Content } from 'mdast'

const parser = unified().use(remarkParse)

export function parseMarkdown(content: string): Root {
  return parser.parse(content)
}

export function getTextContent(node: Content): string {
  if ('value' in node) return node.value
  if ('children' in node) {
    return (node.children as Content[]).map(getTextContent).join('')
  }
  return ''
}
