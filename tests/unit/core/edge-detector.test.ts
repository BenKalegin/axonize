import { describe, it, expect } from 'vitest'
import { detectLinks } from '@core/graph/edge-detector'
import type { Block } from '@core/markdown/types'

function makeBlock(content: string, id = 'test-id'): Block {
  return {
    id,
    type: 'paragraph',
    depth: 0,
    content,
    headingPath: [],
    filePath: 'test.md',
    startLine: 1,
    endLine: 1,
    children: []
  }
}

describe('Edge Detector', () => {
  it('should detect wikilinks', () => {
    const block = makeBlock('See [[architecture]] for details')
    const links = detectLinks(block)

    expect(links).toHaveLength(1)
    expect(links[0].type).toBe('wikilink')
    expect(links[0].target).toBe('architecture')
  })

  it('should detect wikilinks with aliases', () => {
    const block = makeBlock('See [[architecture|the arch doc]]')
    const links = detectLinks(block)

    expect(links).toHaveLength(1)
    expect(links[0].target).toBe('architecture')
  })

  it('should detect wikilinks with fragments', () => {
    const block = makeBlock('See [[architecture#Graph]]')
    const links = detectLinks(block)

    expect(links).toHaveLength(1)
    expect(links[0].target).toBe('architecture')
    expect(links[0].fragment).toBe('Graph')
  })

  it('should detect markdown links', () => {
    const block = makeBlock('See [getting started](getting-started.md)')
    const links = detectLinks(block)

    expect(links).toHaveLength(1)
    expect(links[0].type).toBe('markdown')
    expect(links[0].target).toBe('getting-started')
  })

  it('should skip external links', () => {
    const block = makeBlock('See [Google](https://google.com)')
    const links = detectLinks(block)
    expect(links).toHaveLength(0)
  })

  it('should detect multiple links', () => {
    const block = makeBlock('See [[a]] and [[b]] and [c](c.md)')
    const links = detectLinks(block)
    expect(links).toHaveLength(3)
  })

  it('should return empty for no links', () => {
    const block = makeBlock('Just plain text')
    const links = detectLinks(block)
    expect(links).toHaveLength(0)
  })
})
