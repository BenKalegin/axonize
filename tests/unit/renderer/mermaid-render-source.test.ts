import { describe, expect, it } from 'vitest'
import {
  extractMermaidCodeFence,
  isMermaidRenderSource,
  prepareMermaidSourceForRender,
  stripMermaidFrontmatter
} from '../../../src/renderer/lib/mermaid-render-source'

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
})
