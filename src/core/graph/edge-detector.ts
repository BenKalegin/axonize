import type { Block } from '../markdown/types'

export interface LinkReference {
  type: 'wikilink' | 'markdown'
  target: string
  fragment?: string
  sourceBlockId: string
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g

export function detectLinks(block: Block): LinkReference[] {
  const links: LinkReference[] = []

  // Detect wikilinks: [[target]] or [[target|alias]]
  let match: RegExpExecArray | null
  const content = block.content

  WIKILINK_RE.lastIndex = 0
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const raw = match[1]
    const [target, fragment] = raw.split('#')
    links.push({
      type: 'wikilink',
      target: target || block.filePath.replace(/\.md$/, ''),
      fragment,
      sourceBlockId: block.id
    })
  }

  // Detect markdown links: [text](url)
  MD_LINK_RE.lastIndex = 0
  while ((match = MD_LINK_RE.exec(content)) !== null) {
    const url = match[2]
    if (url.startsWith('http')) continue // skip external links
    const [target, fragment] = url.split('#')
    links.push({
      type: 'markdown',
      target: target.replace(/\.md$/, ''),
      fragment,
      sourceBlockId: block.id
    })
  }

  return links
}
