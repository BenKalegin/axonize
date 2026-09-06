import { describe, it, expect } from 'vitest'
import { splitSections } from '@/lib/section-splitter'

describe('splitSections — HTML islands', () => {
  it('splits a fenced html block into its own atomic section', () => {
    const md = '# Title\n\nSome prose.\n\n```html\n<div>hi</div>\n```\n\nMore prose.'
    const sections = splitSections(md)
    const html = sections.filter((s) => s.kind === 'html')
    expect(html).toHaveLength(1)
    expect(html[0].title).toBe('HTML')
    expect(html[0].rawMarkdown).toContain('```html')
    expect(html[0].rawMarkdown).toContain('<div>hi</div>')
  })

  it('does not absorb following prose into the html section', () => {
    const md = '```html\n<p>a</p>\n```\n\nAfter.'
    const sections = splitSections(md)
    const html = sections.find((s) => s.kind === 'html')!
    expect(html.rawMarkdown).not.toContain('After.')
    expect(sections.some((s) => s.kind === 'preamble' && s.rawMarkdown.includes('After.'))).toBe(true)
  })

  it('leaves non-html code fences untouched', () => {
    const md = '```js\nconst x = 1\n```'
    const sections = splitSections(md)
    expect(sections.some((s) => s.kind === 'html')).toBe(false)
  })

  it('treats each html block as a separate section', () => {
    const md = '```html\n<p>1</p>\n```\n\n```html\n<p>2</p>\n```'
    const sections = splitSections(md)
    expect(sections.filter((s) => s.kind === 'html')).toHaveLength(2)
  })

  it('splits a fenced interact block into its own atomic section', () => {
    const md = '# Title\n\nProse.\n\n```interact\n<button>x</button>\n```\n\nMore.'
    const sections = splitSections(md)
    const interact = sections.filter((s) => s.kind === 'interact')
    expect(interact).toHaveLength(1)
    expect(interact[0].title).toBe('Interactive')
    expect(interact[0].rawMarkdown).not.toContain('More.')
  })

  it('splits a fenced vega-lite block into its own atomic chart section', () => {
    const spec = '{"mark":"bar","encoding":{"x":{"field":"a"},"y":{"field":"b"}}}'
    const md = `# Title\n\nProse.\n\n\`\`\`vega-lite\n${spec}\n\`\`\`\n\nAfter.`
    const sections = splitSections(md)
    const vega = sections.filter((s) => s.kind === 'vega')
    expect(vega).toHaveLength(1)
    expect(vega[0].title).toBe('Chart')
    expect(vega[0].rawMarkdown).toContain('```vega-lite')
    expect(vega[0].rawMarkdown).not.toContain('After.')
  })
})
