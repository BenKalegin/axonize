import { describe, it, expect } from 'vitest'
import { filterNodesForZoom, filterEdgesForZoom } from '@core/zoom/zoom-filter'

const nodes = [
  { id: '1', type: 'file', label: 'A' },
  { id: '2', type: 'heading', label: 'B' },
  { id: '3', type: 'block', label: 'C' },
  { id: '4', type: 'block', label: 'D' }
]

const edges = [
  { source: '1', target: '2', type: 'contains' },
  { source: '1', target: '3', type: 'contains' },
  { source: '2', target: '4', type: 'contains' },
  { source: '3', target: '4', type: 'links_to' }
]

describe('Zoom Filter', () => {
  it('Z0 should only show file and heading nodes', () => {
    const filtered = filterNodesForZoom(nodes, 'Z0')
    expect(filtered).toHaveLength(2)
    expect(filtered.map(n => n.type)).toEqual(['file', 'heading'])
  })

  it('Z1 should only show file and heading nodes', () => {
    const filtered = filterNodesForZoom(nodes, 'Z1')
    expect(filtered).toHaveLength(2)
  })

  it('Z2+ should show all nodes', () => {
    expect(filterNodesForZoom(nodes, 'Z2')).toHaveLength(4)
    expect(filterNodesForZoom(nodes, 'Z3')).toHaveLength(4)
    expect(filterNodesForZoom(nodes, 'Z4')).toHaveLength(4)
  })

  it('should filter edges to visible nodes', () => {
    const visibleNodes = filterNodesForZoom(nodes, 'Z0')
    const visibleIds = new Set(visibleNodes.map(n => n.id))
    const filteredEdges = filterEdgesForZoom(edges, visibleIds, 'Z0')

    expect(filteredEdges).toHaveLength(1) // only 1->2 is visible
    expect(filteredEdges[0].source).toBe('1')
    expect(filteredEdges[0].target).toBe('2')
  })

  it('Z4 should keep all edges', () => {
    const visibleIds = new Set(nodes.map(n => n.id))
    const filteredEdges = filterEdgesForZoom(edges, visibleIds, 'Z4')
    expect(filteredEdges).toHaveLength(4)
  })
})
