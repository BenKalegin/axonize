import type { Root, Content, Heading } from 'mdast'
import type { Block } from './types'
import { generateBlockId } from './block-id'
import { getTextContent } from './parser'

export function extractBlocks(ast: Root, filePath: string): Block[] {
  const blocks: Block[] = []
  const headingStack: { depth: number; text: string }[] = []

  const documentBlock: Block = {
    id: generateBlockId(filePath, [], filePath),
    type: 'document',
    depth: 0,
    content: '',
    headingPath: [],
    filePath,
    startLine: 1,
    endLine: ast.position?.end?.line ?? 1,
    children: []
  }
  blocks.push(documentBlock)

  for (const node of ast.children) {
    if (node.type === 'heading') {
      const heading = node as Heading
      const text = heading.children.map(c => getTextContent(c as Content)).join('')

      // Pop headings of same or greater depth
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].depth >= heading.depth) {
        headingStack.pop()
      }
      headingStack.push({ depth: heading.depth, text })

      const headingPath = headingStack.map(h => h.text)
      const block: Block = {
        id: generateBlockId(filePath, headingPath, text),
        type: 'heading',
        depth: heading.depth,
        content: text,
        headingPath,
        filePath,
        startLine: node.position?.start?.line ?? 0,
        endLine: node.position?.end?.line ?? 0,
        children: []
      }
      blocks.push(block)
      documentBlock.children.push(block)
    } else {
      const content = getTextContent(node as Content)
      const headingPath = headingStack.map(h => h.text)
      const blockType = node.type === 'list' ? 'list'
        : node.type === 'code' ? 'code'
        : node.type === 'blockquote' ? 'blockquote'
        : 'paragraph'

      const block: Block = {
        id: generateBlockId(filePath, headingPath, content),
        type: blockType,
        depth: headingStack.length > 0 ? headingStack[headingStack.length - 1].depth : 0,
        content,
        headingPath,
        filePath,
        startLine: node.position?.start?.line ?? 0,
        endLine: node.position?.end?.line ?? 0,
        children: []
      }
      blocks.push(block)
      documentBlock.children.push(block)
    }
  }

  return blocks
}
