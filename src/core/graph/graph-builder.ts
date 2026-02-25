import type { ParsedDocument } from '../markdown/types'
import type { GraphNode, GraphEdge, SemanticGraph } from './types'
import { detectLinks } from './edge-detector'

export function buildGraph(documents: ParsedDocument[]): SemanticGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeIdSet = new Set<string>()
  const edgeIdSet = new Set<string>()

  // Index: filename (without .md) -> document block id
  const fileIndex = new Map<string, string>()
  // Index: blockId -> node
  const blockIndex = new Map<string, GraphNode>()
  // Index: filePath#headingText -> blockId
  const headingIndex = new Map<string, string>()

  // Pass 1: Create nodes from all documents
  for (const doc of documents) {
    for (const block of doc.blocks) {
      if (nodeIdSet.has(block.id)) continue
      nodeIdSet.add(block.id)

      const node: GraphNode = {
        id: block.id,
        label: block.type === 'document'
          ? block.filePath.replace(/\.md$/, '').split('/').pop() || block.filePath
          : block.content.slice(0, 50),
        type: block.type === 'document' ? 'file'
          : block.type === 'heading' ? 'heading'
          : 'block',
        filePath: block.filePath,
        blockPath: block.headingPath.join('/')
      }
      nodes.push(node)
      blockIndex.set(block.id, node)

      if (block.type === 'document') {
        const baseName = block.filePath.replace(/\.md$/, '').split('/').pop() || ''
        fileIndex.set(baseName.toLowerCase(), block.id)
      }

      if (block.type === 'heading') {
        const key = `${block.filePath}#${block.content}`.toLowerCase()
        headingIndex.set(key, block.id)
      }
    }
  }

  // Pass 2: Create `contains` edges (document -> children)
  for (const doc of documents) {
    const documentBlock = doc.blocks.find(b => b.type === 'document')
    if (!documentBlock) continue

    for (const child of documentBlock.children) {
      const edgeId = `contains:${documentBlock.id}:${child.id}`
      if (!edgeIdSet.has(edgeId)) {
        edgeIdSet.add(edgeId)
        edges.push({
          id: edgeId,
          source: documentBlock.id,
          target: child.id,
          type: 'contains'
        })
      }
    }
  }

  // Pass 3: Create `links_to` edges from wikilinks and markdown links
  for (const doc of documents) {
    for (const block of doc.blocks) {
      const links = detectLinks(block)
      for (const link of links) {
        let targetId: string | undefined

        // Try heading index first (file#heading)
        if (link.fragment) {
          const key = `${link.target}.md#${link.fragment}`.toLowerCase()
          targetId = headingIndex.get(key)
          if (!targetId) {
            // Try just fragment within same file
            const sameFileKey = `${block.filePath}#${link.fragment}`.toLowerCase()
            targetId = headingIndex.get(sameFileKey)
          }
        }

        // Try file index
        if (!targetId) {
          targetId = fileIndex.get(link.target.toLowerCase())
        }

        if (targetId && targetId !== block.id) {
          const edgeId = `links_to:${block.id}:${targetId}`
          if (!edgeIdSet.has(edgeId)) {
            edgeIdSet.add(edgeId)
            edges.push({
              id: edgeId,
              source: block.id,
              target: targetId,
              type: 'links_to'
            })
          }
        }
      }
    }
  }

  // Pass 4: Create `related_to` edges (same-directory file nodes)
  const dirGroups = new Map<string, string[]>()
  for (const doc of documents) {
    const docBlock = doc.blocks.find(b => b.type === 'document')
    if (!docBlock) continue
    const dir = docBlock.filePath.includes('/')
      ? docBlock.filePath.slice(0, docBlock.filePath.lastIndexOf('/'))
      : ''
    if (!dirGroups.has(dir)) dirGroups.set(dir, [])
    dirGroups.get(dir)!.push(docBlock.id)
  }

  for (const [, ids] of dirGroups) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const edgeId = `related_to:${ids[i]}:${ids[j]}`
        if (!edgeIdSet.has(edgeId)) {
          edgeIdSet.add(edgeId)
          edges.push({
            id: edgeId,
            source: ids[i],
            target: ids[j],
            type: 'related_to'
          })
        }
      }
    }
  }

  return { nodes, edges }
}
