import type { SemanticGraph } from './types'

export function serializeGraph(graph: SemanticGraph): string {
  return JSON.stringify(graph, null, 2)
}

export function deserializeGraph(json: string): SemanticGraph {
  return JSON.parse(json) as SemanticGraph
}
