export interface GraphNode {
  id: string
  label: string
  type: 'file' | 'heading' | 'block'
  filePath: string
  blockPath?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: 'contains' | 'links_to' | 'related_to'
}

export interface SemanticGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
