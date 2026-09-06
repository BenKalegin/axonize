import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MERMAID_RENDERER,
  MermaidRenderer,
  getMermaidRenderer,
  setMermaidRenderer
} from '../../../src/core/markdown/mermaid-renderer-flag'

describe('mermaid renderer flag', () => {
  it('defaults to doodles when no frontmatter is present', () => {
    expect(getMermaidRenderer('flowchart LR\nA --> B')).toBe(DEFAULT_MERMAID_RENDERER)
    expect(DEFAULT_MERMAID_RENDERER).toBe(MermaidRenderer.Doodles)
  })

  it('defaults to doodles when frontmatter omits the renderer key', () => {
    const source = `---\nconfig:\n  theme: base\n---\nflowchart LR\nA --> B`
    expect(getMermaidRenderer(source)).toBe(MermaidRenderer.Doodles)
  })

  it('reads renderer: legacy from top-level frontmatter', () => {
    const source = `---\nrenderer: legacy\n---\nflowchart LR\nA --> B`
    expect(getMermaidRenderer(source)).toBe(MermaidRenderer.Legacy)
  })

  it('reads renderer: doodles explicitly', () => {
    const source = `---\nrenderer: doodles\n---\nflowchart LR\nA --> B`
    expect(getMermaidRenderer(source)).toBe(MermaidRenderer.Doodles)
  })

  it('falls back to default for unrecognized renderer values', () => {
    const source = `---\nrenderer: bogus\n---\nflowchart LR\nA --> B`
    expect(getMermaidRenderer(source)).toBe(DEFAULT_MERMAID_RENDERER)
  })

  it('adds renderer: legacy when no frontmatter exists', () => {
    const source = `flowchart LR\nA --> B`
    const next = setMermaidRenderer(source, MermaidRenderer.Legacy)
    expect(next).toBe(`---\nrenderer: legacy\n---\nflowchart LR\nA --> B`)
    expect(getMermaidRenderer(next)).toBe(MermaidRenderer.Legacy)
  })

  it('omits the renderer key when setting the default', () => {
    const source = `flowchart LR\nA --> B`
    expect(setMermaidRenderer(source, MermaidRenderer.Doodles)).toBe(source)
  })

  it('removes the renderer key when switching back to default', () => {
    const source = `---\nrenderer: legacy\n---\nflowchart LR\nA --> B`
    const next = setMermaidRenderer(source, MermaidRenderer.Doodles)
    expect(next).toBe(`flowchart LR\nA --> B`)
  })

  it('preserves other frontmatter keys when toggling renderer', () => {
    const source = `---\nconfig:\n  theme: base\nrenderer: legacy\n---\nflowchart LR\nA --> B`
    const next = setMermaidRenderer(source, MermaidRenderer.Doodles)
    expect(next).toContain('config:')
    expect(next).toContain('theme: base')
    expect(next).not.toContain('renderer:')
  })

  it('is idempotent when setting the same value twice', () => {
    const source = `flowchart LR\nA --> B`
    const once = setMermaidRenderer(source, MermaidRenderer.Legacy)
    const twice = setMermaidRenderer(once, MermaidRenderer.Legacy)
    expect(twice).toBe(once)
  })

  it('replaces an existing renderer value rather than duplicating it', () => {
    const source = `---\nrenderer: doodles\n---\nflowchart LR\nA --> B`
    const next = setMermaidRenderer(source, MermaidRenderer.Legacy)
    const rendererLines = next.split('\n').filter((line) => line.startsWith('renderer:'))
    expect(rendererLines).toEqual(['renderer: legacy'])
  })
})
