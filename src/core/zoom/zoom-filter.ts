import type { ZoomLevel } from './zoom-levels'

interface FilterableNode {
  id: string
  type: string
}

interface FilterableEdge {
  source: string
  target: string
  type: string
}

export function filterNodesForZoom<N extends FilterableNode>(
  nodes: N[],
  level: ZoomLevel
): N[] {
  switch (level) {
    case 'Z0':
    case 'Z1':
      // Show only file and heading nodes
      return nodes.filter(n => n.type === 'file' || n.type === 'heading')
    case 'Z2':
    case 'Z3':
    case 'Z4':
      // Show all nodes
      return nodes
  }
}

export function filterEdgesForZoom<E extends FilterableEdge>(
  edges: E[],
  visibleNodeIds: Set<string>,
  _level: ZoomLevel
): E[] {
  return edges.filter(e => {
    const sourceId = typeof e.source === 'object' ? (e.source as unknown as FilterableNode).id : e.source
    const targetId = typeof e.target === 'object' ? (e.target as unknown as FilterableNode).id : e.target
    return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
  })
}
