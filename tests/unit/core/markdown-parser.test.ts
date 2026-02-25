import { describe, it, expect } from 'vitest'
import { parseMarkdown, getTextContent } from '@core/markdown/parser'

describe('Markdown Parser', () => {
  it('should parse markdown into AST', () => {
    const ast = parseMarkdown('# Hello\n\nWorld')
    expect(ast.type).toBe('root')
    expect(ast.children).toHaveLength(2)
    expect(ast.children[0].type).toBe('heading')
    expect(ast.children[1].type).toBe('paragraph')
  })

  it('should handle empty content', () => {
    const ast = parseMarkdown('')
    expect(ast.type).toBe('root')
    expect(ast.children).toHaveLength(0)
  })

  it('should parse nested headings', () => {
    const ast = parseMarkdown('# H1\n## H2\n### H3')
    expect(ast.children).toHaveLength(3)
    expect(ast.children[0].type).toBe('heading')
    expect(ast.children[1].type).toBe('heading')
    expect(ast.children[2].type).toBe('heading')
  })

  it('should extract text content from nodes', () => {
    const ast = parseMarkdown('# Hello **world**')
    const heading = ast.children[0]
    expect(getTextContent(heading)).toBe('Hello world')
  })
})
