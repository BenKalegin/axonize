import { describe, it, expect } from 'vitest'
import { generateBlockId } from '@core/markdown/block-id'

describe('Block ID', () => {
  it('should generate a 16-char hex string', () => {
    const id = generateBlockId('test.md', ['Heading'], 'content')
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('should be deterministic', () => {
    const id1 = generateBlockId('test.md', ['Heading'], 'content')
    const id2 = generateBlockId('test.md', ['Heading'], 'content')
    expect(id1).toBe(id2)
  })

  it('should differ for different files', () => {
    const id1 = generateBlockId('a.md', ['H'], 'content')
    const id2 = generateBlockId('b.md', ['H'], 'content')
    expect(id1).not.toBe(id2)
  })

  it('should differ for different heading paths', () => {
    const id1 = generateBlockId('test.md', ['A'], 'content')
    const id2 = generateBlockId('test.md', ['B'], 'content')
    expect(id1).not.toBe(id2)
  })

  it('should differ for different content', () => {
    const id1 = generateBlockId('test.md', ['H'], 'content a')
    const id2 = generateBlockId('test.md', ['H'], 'content b')
    expect(id1).not.toBe(id2)
  })

  it('should normalize whitespace', () => {
    const id1 = generateBlockId('test.md', ['H'], 'hello   world')
    const id2 = generateBlockId('test.md', ['H'], 'hello world')
    expect(id1).toBe(id2)
  })
})
