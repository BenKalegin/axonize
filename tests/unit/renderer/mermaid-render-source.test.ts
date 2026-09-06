import { describe, expect, it } from 'vitest'
import {
  extractMermaidCodeFence,
  getMermaidRendererFromMarkdown,
  isMermaidRenderSource,
  prepareMermaidSourceForRender,
  setMermaidRendererInMarkdown,
  stripMermaidFrontmatter
} from '../../../src/renderer/lib/mermaid-render-source'
import { MermaidRenderer } from '../../../src/core/markdown/mermaid-renderer-flag'

describe('mermaid render source', () => {
  it('detects explicit and classless mermaid sources', () => {
    expect(isMermaidRenderSource('not a diagram', 'hljs language-mermaid')).toBe(true)
    expect(isMermaidRenderSource('flowchart TD\nA --> B')).toBe(true)
    expect(isMermaidRenderSource('plain code')).toBe(false)
  })

  it('strips Axonize and Mermaid config frontmatter so Axonize owns render theming', () => {
    const source = `---
config:
  theme: base
x-axonize:
  version: 1
  layout:
    nodes:
      User: { x: 80, y: 120 }
---
classDiagram
class User`

    const prepared = prepareMermaidSourceForRender(source)

    expect(prepared).not.toContain('config:')
    expect(prepared).not.toContain('theme: base')
    expect(prepared).not.toContain('x-axonize:')
    expect(prepared).not.toContain('nodes:')
    expect(prepared).toBe('classDiagram\nclass User')
  })

  it('can remove all Mermaid frontmatter for fallback rendering', () => {
    const stripped = stripMermaidFrontmatter(`---
config:
  theme: base
---
sequenceDiagram
A->>B: hello`)

    expect(stripped).toBe('sequenceDiagram\nA->>B: hello')
  })

  it('extracts source from a Mermaid fenced code section', () => {
    expect(extractMermaidCodeFence(`\`\`\`mermaid
flowchart TD
A --> B
\`\`\``)).toBe('flowchart TD\nA --> B')
  })

  it('strips the top-level renderer key so it never reaches doodles or mermaid lib', () => {
    const source = `---
renderer: legacy
---
flowchart LR
A --> B`
    const prepared = prepareMermaidSourceForRender(source)
    expect(prepared).not.toContain('renderer:')
    expect(prepared).toBe('flowchart LR\nA --> B')
  })

  it('preserves the renderer flag when round-tripping through the fence helpers', () => {
    const markdown = '```mermaid\nflowchart LR\nA --> B\n```'
    expect(getMermaidRendererFromMarkdown(markdown)).toBe(MermaidRenderer.Doodles)

    const withLegacy = setMermaidRendererInMarkdown(markdown, MermaidRenderer.Legacy)
    expect(withLegacy).toContain('---\nrenderer: legacy\n---')
    expect(withLegacy.startsWith('```mermaid')).toBe(true)
    expect(withLegacy.endsWith('```')).toBe(true)
    expect(getMermaidRendererFromMarkdown(withLegacy)).toBe(MermaidRenderer.Legacy)

    const backToDoodles = setMermaidRendererInMarkdown(withLegacy, MermaidRenderer.Doodles)
    expect(backToDoodles).toBe(markdown)
  })
})
