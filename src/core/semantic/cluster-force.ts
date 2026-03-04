import type { SemanticCard } from './types'

interface SimNode {
  id?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

type ForceFunction = {
  (alpha: number): void
  initialize?: (nodes: SimNode[]) => void
  strength?: (s: number) => ForceFunction
}

export function createClusterForce(cards: SemanticCard[], strength: number): ForceFunction {
  let nodes: SimNode[] = []
  const filePathById = new Map<string, string>(cards.map((c) => [c.id, c.filePath]))

  const force: ForceFunction = (alpha: number) => {
    const centroids = computeCentroids(nodes, filePathById)
    applyClusterAttraction(nodes, filePathById, centroids, alpha, strength)
  }

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes
  }

  return force
}

interface Centroid {
  x: number
  y: number
  count: number
}

function computeCentroids(
  nodes: SimNode[],
  filePathById: Map<string, string>
): Map<string, Centroid> {
  const centroids = new Map<string, Centroid>()
  for (const node of nodes) {
    const filePath = filePathById.get(node.id ?? '')
    if (!filePath) continue
    const entry = centroids.get(filePath) ?? { x: 0, y: 0, count: 0 }
    entry.x += node.x ?? 0
    entry.y += node.y ?? 0
    entry.count++
    centroids.set(filePath, entry)
  }
  for (const entry of centroids.values()) {
    if (entry.count > 0) {
      entry.x /= entry.count
      entry.y /= entry.count
    }
  }
  return centroids
}

function applyClusterAttraction(
  nodes: SimNode[],
  filePathById: Map<string, string>,
  centroids: Map<string, Centroid>,
  alpha: number,
  strength: number
): void {
  for (const node of nodes) {
    const filePath = filePathById.get(node.id ?? '')
    if (!filePath) continue
    const centroid = centroids.get(filePath)
    if (!centroid || centroid.count <= 1) continue
    const dx = centroid.x - (node.x ?? 0)
    const dy = centroid.y - (node.y ?? 0)
    node.vx = (node.vx ?? 0) + dx * alpha * strength
    node.vy = (node.vy ?? 0) + dy * alpha * strength
  }
}
