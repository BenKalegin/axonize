import { describe, it, expect } from 'vitest'
import { buildGraph } from '@core/graph/graph-builder'
import { parseMarkdown } from '@core/markdown/parser'
import { extractBlocks } from '@core/markdown/block-extractor'
import type { ParsedDocument } from '@core/markdown/types'

function createDoc(filePath: string, content: string): ParsedDocument {
  const ast = parseMarkdown(content)
  const blocks = extractBlocks(ast, filePath)
  return { filePath, blocks }
}

describe('Graph Builder', () => {
  it('should create nodes from a single document', () => {
    const doc = createDoc('welcome.md', '# Welcome\n\nHello world')
    const graph = buildGraph([doc])

    expect(graph.nodes.length).toBeGreaterThanOrEqual(3)
    const fileNode = graph.nodes.find(n => n.type === 'file')
    expect(fileNode).toBeDefined()
    expect(fileNode!.label).toBe('welcome')
  })

  it('should create contains edges', () => {
    const doc = createDoc('test.md', '# Title\n\nParagraph')
    const graph = buildGraph([doc])

    const containsEdges = graph.edges.filter(e => e.type === 'contains')
    expect(containsEdges.length).toBeGreaterThanOrEqual(2)
  })

  it('should create links_to edges for wikilinks', () => {
    const doc1 = createDoc('a.md', '# A\n\nSee [[b]]')
    const doc2 = createDoc('b.md', '# B\n\nHello')
    const graph = buildGraph([doc1, doc2])

    const linkEdges = graph.edges.filter(e => e.type === 'links_to')
    expect(linkEdges).toHaveLength(1)

    // Verify the link points from a block in a.md to the b.md document node
    const targetNode = graph.nodes.find(n => n.id === linkEdges[0].target)
    expect(targetNode).toBeDefined()
    expect(targetNode!.filePath).toBe('b.md')
  })

  it('should create related_to edges for same-directory files', () => {
    const doc1 = createDoc('a.md', '# A')
    const doc2 = createDoc('b.md', '# B')
    const graph = buildGraph([doc1, doc2])

    const relatedEdges = graph.edges.filter(e => e.type === 'related_to')
    expect(relatedEdges).toHaveLength(1)
  })

  it('should not create related_to edges across directories', () => {
    const doc1 = createDoc('a.md', '# A')
    const doc2 = createDoc('notes/b.md', '# B')
    const graph = buildGraph([doc1, doc2])

    const relatedEdges = graph.edges.filter(e => e.type === 'related_to')
    expect(relatedEdges).toHaveLength(0)
  })

  it('should handle links with fragments', () => {
    const doc1 = createDoc('a.md', '# A\n\nSee [[b#Features]]')
    const doc2 = createDoc('b.md', '# B\n\n## Features\n\nStuff')
    const graph = buildGraph([doc1, doc2])

    const linkEdges = graph.edges.filter(e => e.type === 'links_to')
    expect(linkEdges).toHaveLength(1)

    // Should point to the Features heading
    const targetNode = graph.nodes.find(n => n.id === linkEdges[0].target)
    expect(targetNode).toBeDefined()
    expect(targetNode!.type).toBe('heading')
  })

  it('should generate unique edge IDs', () => {
    const doc1 = createDoc('a.md', '# A\n\nSee [[b]]')
    const doc2 = createDoc('b.md', '# B\n\nSee [[a]]')
    const graph = buildGraph([doc1, doc2])

    const ids = graph.edges.map(e => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should build graph from multiple documents', () => {
    const docs = [
      createDoc('welcome.md', '# Welcome\n\nSee [[architecture]]'),
      createDoc('architecture.md', '# Architecture\n\n## Blocks\n\nDetails'),
      createDoc('notes/daily.md', '# Daily\n\nSee [[architecture#Blocks]]')
    ]
    const graph = buildGraph(docs)

    expect(graph.nodes.length).toBeGreaterThan(5)
    expect(graph.edges.length).toBeGreaterThan(3)

    const linkEdges = graph.edges.filter(e => e.type === 'links_to')
    expect(linkEdges.length).toBeGreaterThanOrEqual(2)
  })
})
