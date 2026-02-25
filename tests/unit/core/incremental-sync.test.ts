import { describe, it, expect } from 'vitest'
import { fullSync, incrementalSync } from '@core/integrity/incremental-sync'

const sampleFiles = [
  { relativePath: 'welcome.md', content: '# Welcome\n\nHello [[architecture]]', modifiedAt: 1000 },
  { relativePath: 'architecture.md', content: '# Architecture\n\n## Blocks\n\nDetails', modifiedAt: 1000 }
]

describe('Incremental Sync', () => {
  it('should perform full sync', () => {
    const result = fullSync('/vault', sampleFiles)

    expect(result.state.files).toHaveLength(2)
    expect(result.documents).toHaveLength(2)
    expect(result.graph.nodes.length).toBeGreaterThan(0)
    expect(result.graph.edges.length).toBeGreaterThan(0)
    expect(result.changedFiles).toBe(2)
  })

  it('should detect no changes in incremental sync', () => {
    const initial = fullSync('/vault', sampleFiles)
    const result = incrementalSync('/vault', initial.state, sampleFiles)

    expect(result.changedFiles).toBe(0)
    expect(result.graph.nodes.length).toBe(initial.graph.nodes.length)
  })

  it('should detect changes in incremental sync', () => {
    const initial = fullSync('/vault', sampleFiles)

    const modifiedFiles = [
      ...sampleFiles,
      { relativePath: 'new.md', content: '# New\n\nContent', modifiedAt: 2000 }
    ]

    const result = incrementalSync('/vault', initial.state, modifiedFiles)
    expect(result.changedFiles).toBe(3)
    expect(result.state.files).toHaveLength(3)
  })

  it('should build graph with links', () => {
    const result = fullSync('/vault', sampleFiles)

    const linkEdges = result.graph.edges.filter(e => e.type === 'links_to')
    expect(linkEdges.length).toBeGreaterThanOrEqual(1)
  })

  it('should produce deterministic results', () => {
    const result1 = fullSync('/vault', sampleFiles)
    const result2 = fullSync('/vault', sampleFiles)

    expect(result1.graph.nodes.map(n => n.id).sort())
      .toEqual(result2.graph.nodes.map(n => n.id).sort())
    expect(result1.graph.edges.map(e => e.id).sort())
      .toEqual(result2.graph.edges.map(e => e.id).sort())
  })
})
