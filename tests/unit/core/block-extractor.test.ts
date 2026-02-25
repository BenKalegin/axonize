import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '@core/markdown/parser'
import { extractBlocks } from '@core/markdown/block-extractor'

describe('Block Extractor', () => {
  it('should extract document block', () => {
    const ast = parseMarkdown('# Hello')
    const blocks = extractBlocks(ast, 'test.md')

    expect(blocks[0].type).toBe('document')
    expect(blocks[0].filePath).toBe('test.md')
  })

  it('should extract heading blocks', () => {
    const ast = parseMarkdown('# Title\n\n## Subtitle')
    const blocks = extractBlocks(ast, 'test.md')

    const headings = blocks.filter(b => b.type === 'heading')
    expect(headings).toHaveLength(2)
    expect(headings[0].content).toBe('Title')
    expect(headings[0].headingPath).toEqual(['Title'])
    expect(headings[1].content).toBe('Subtitle')
    expect(headings[1].headingPath).toEqual(['Title', 'Subtitle'])
  })

  it('should track heading hierarchy', () => {
    const ast = parseMarkdown('# A\n## B\n### C\n## D')
    const blocks = extractBlocks(ast, 'test.md')

    const headings = blocks.filter(b => b.type === 'heading')
    expect(headings[0].headingPath).toEqual(['A'])
    expect(headings[1].headingPath).toEqual(['A', 'B'])
    expect(headings[2].headingPath).toEqual(['A', 'B', 'C'])
    expect(headings[3].headingPath).toEqual(['A', 'D'])
  })

  it('should extract paragraph blocks', () => {
    const ast = parseMarkdown('# Hello\n\nSome text here')
    const blocks = extractBlocks(ast, 'test.md')

    const paragraphs = blocks.filter(b => b.type === 'paragraph')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].content).toBe('Some text here')
  })

  it('should extract list blocks', () => {
    const ast = parseMarkdown('- Item 1\n- Item 2')
    const blocks = extractBlocks(ast, 'test.md')

    const lists = blocks.filter(b => b.type === 'list')
    expect(lists).toHaveLength(1)
  })

  it('should extract code blocks', () => {
    const ast = parseMarkdown('```js\nconst x = 1\n```')
    const blocks = extractBlocks(ast, 'test.md')

    const code = blocks.filter(b => b.type === 'code')
    expect(code).toHaveLength(1)
    expect(code[0].content).toBe('const x = 1')
  })

  it('should generate unique block IDs', () => {
    const ast = parseMarkdown('# A\n\nParagraph\n\n# B\n\nParagraph')
    const blocks = extractBlocks(ast, 'test.md')

    const ids = blocks.map(b => b.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should generate deterministic block IDs', () => {
    const ast1 = parseMarkdown('# Hello\n\nWorld')
    const ast2 = parseMarkdown('# Hello\n\nWorld')
    const blocks1 = extractBlocks(ast1, 'test.md')
    const blocks2 = extractBlocks(ast2, 'test.md')

    expect(blocks1.map(b => b.id)).toEqual(blocks2.map(b => b.id))
  })
})
