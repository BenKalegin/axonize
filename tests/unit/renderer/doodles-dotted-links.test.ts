import { describe, expect, it } from 'vitest'
import { renderMermaidWithDoodles } from '../../../src/renderer/lib/doodles-render'

// Regression: doodles' Mermaid importer used to silently drop dotted-link
// statements (`-.->`), taking any node introduced only on that line with them.
// The legacy/ELK renderer draws them as dotted edges, so doodles must too.
describe('doodles dotted flowchart links', () => {
  it('keeps nodes introduced on a dotted-link line and renders them dashed', async () => {
    const source = [
      'flowchart LR',
      '    subgraph IDM["IDM"]',
      '        MCP["IDM MCP server"]',
      '    end',
      '    RA["ResearchAgent"] --> MCP',
      '    MCP -.->|downstream untraced| QMARK["( ? )"]',
      '    V3["/v3/search"] -.->|no IDM caller found| NOUSE["consumer untraced"]',
    ].join('\n')

    const svg = await renderMermaidWithDoodles(source)

    // Nodes that only appear on dotted-link lines must survive.
    expect(svg).toContain('( ? )')
    expect(svg).toContain('consumer untraced')
    // The dotted edges keep their solid neighbours company and render dashed.
    expect(svg).toContain('downstream untraced')
    expect(svg).toContain('no IDM caller found')
    expect(svg).toContain('stroke-dasharray')
  })

  it('leaves solid links solid', async () => {
    const svg = await renderMermaidWithDoodles('flowchart LR\n A --> B')
    expect(svg).not.toContain('stroke-dasharray')
  })
})
