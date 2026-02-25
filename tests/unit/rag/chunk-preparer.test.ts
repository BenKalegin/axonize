import { describe, it, expect } from 'vitest'
import { blocksToChunks } from '@core/rag/chunk-preparer'
import type { Block } from '@core/markdown/types'

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    type: 'paragraph',
    depth: 0,
    content: 'This is a sufficiently long paragraph for testing purposes.',
    headingPath: [],
    filePath: 'docs/test.md',
    startLine: 1,
    endLine: 5,
    children: [],
    ...overrides
  }
}

describe('blocksToChunks', () => {
  it('converts a paragraph block to a chunk', () => {
    const blocks = [makeBlock()]
    const chunks = blocksToChunks(blocks)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].id).toBe('block-1')
    expect(chunks[0].filePath).toBe('docs/test.md')
    expect(chunks[0].blockType).toBe('paragraph')
    expect(chunks[0].startLine).toBe(1)
    expect(chunks[0].endLine).toBe(5)
  })

  it('skips document-type blocks', () => {
    const blocks = [makeBlock({ type: 'document', content: 'This is a document block with enough content.' })]
    const chunks = blocksToChunks(blocks)
    expect(chunks).toHaveLength(0)
  })

  it('skips blocks with short content', () => {
    const blocks = [makeBlock({ content: 'Too short.' })]
    const chunks = blocksToChunks(blocks)
    expect(chunks).toHaveLength(0)
  })

  it('skips blocks with only whitespace under threshold', () => {
    const blocks = [makeBlock({ content: '   short   ' })]
    const chunks = blocksToChunks(blocks)
    expect(chunks).toHaveLength(0)
  })

  it('prepends heading path as context when present', () => {
    const blocks = [
      makeBlock({
        headingPath: ['Getting Started', 'Installation'],
        content: 'Run npm install to set up the project dependencies.'
      })
    ]
    const chunks = blocksToChunks(blocks)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe(
      'Getting Started > Installation\n\nRun npm install to set up the project dependencies.'
    )
    expect(chunks[0].headingPath).toEqual(['Getting Started', 'Installation'])
  })

  it('does not prepend heading context when headingPath is empty', () => {
    const content = 'A paragraph with no heading context at all.'
    const blocks = [makeBlock({ headingPath: [], content })]
    const chunks = blocksToChunks(blocks)

    expect(chunks[0].content).toBe(content)
  })

  it('returns empty array for empty input', () => {
    expect(blocksToChunks([])).toEqual([])
  })

  it('processes multiple blocks and filters correctly', () => {
    const blocks = [
      makeBlock({ id: 'b1', type: 'document', content: 'Document block with enough content here.' }),
      makeBlock({ id: 'b2', type: 'heading', content: 'Short' }),
      makeBlock({ id: 'b3', type: 'paragraph', content: 'This paragraph is long enough to pass the threshold.' }),
      makeBlock({ id: 'b4', type: 'code', content: 'const x = 1;\nconst y = 2;\nconst z = x + y;' })
    ]

    const chunks = blocksToChunks(blocks)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].id).toBe('b3')
    expect(chunks[1].id).toBe('b4')
  })

  it('creates independent copies of headingPath', () => {
    const headingPath = ['Section A']
    const blocks = [makeBlock({ headingPath, content: 'Content that is long enough for this test.' })]
    const chunks = blocksToChunks(blocks)

    headingPath.push('Mutated')
    expect(chunks[0].headingPath).toEqual(['Section A'])
  })
})
