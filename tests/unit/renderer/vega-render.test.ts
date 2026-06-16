import { describe, it, expect } from 'vitest'
import { renderVegaLiteAsSvg, looksLikeVegaLite } from '@/lib/vega-render'

const BAR_SPEC = JSON.stringify({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: { values: [
    { month: 'Jan', sales: 28 },
    { month: 'Feb', sales: 55 },
    { month: 'Mar', sales: 43 }
  ] },
  mark: 'bar',
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'sales', type: 'quantitative' }
  }
})

describe('renderVegaLiteAsSvg', () => {
  it('renders a valid bar spec to inline SVG with bar marks', () => {
    const svg = renderVegaLiteAsSvg(BAR_SPEC)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toMatch(/<rect/) // bars
  })

  it('is deterministic / cached — same source yields identical SVG', () => {
    expect(renderVegaLiteAsSvg(BAR_SPEC)).toBe(renderVegaLiteAsSvg(BAR_SPEC))
  })

  it('throws a descriptive error for an unsupported spec (data.url)', () => {
    const urlSpec = JSON.stringify({
      data: { url: 'data.csv' },
      mark: 'bar',
      encoding: { x: { field: 'a' }, y: { field: 'b' } }
    })
    expect(() => renderVegaLiteAsSvg(urlSpec)).toThrow(/data\.url/)
  })
})

describe('looksLikeVegaLite', () => {
  it('accepts a spec with mark + encoding', () => {
    expect(looksLikeVegaLite(BAR_SPEC)).toBe(true)
  })

  it('accepts a spec identified only by its $schema', () => {
    expect(looksLikeVegaLite('{"$schema":"https://vega.github.io/schema/vega-lite/v5.json"}')).toBe(true)
  })

  it('rejects non-JSON and non-Vega content', () => {
    expect(looksLikeVegaLite('not a spec')).toBe(false)
    expect(looksLikeVegaLite('{"foo": 1}')).toBe(false)
  })
})
