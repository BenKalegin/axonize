import { create } from 'zustand'

export interface GraphNode {
  id: string
  label: string
  type: string
  filePath?: string
  blockPath?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
}

interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  setGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void
  selectNode: (id: string | null) => void
  clear: () => void
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  setGraph: (nodes, edges) => set({ nodes, edges }),
  selectNode: (id) => set({ selectedNodeId: id }),
  clear: () => set({ nodes: [], edges: [], selectedNodeId: null })
}))
