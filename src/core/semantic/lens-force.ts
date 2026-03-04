import type { SemanticCard, CardRelation } from './types'
import { CardKind } from './types'

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
}

/**
 * Creates a d3-compatible force that attracts docs toward their target anchor.
 * - lens='by_topic': docs attract toward their cluster card centroid
 * - lens=<dimension key>: docs attract toward hub nodes of that dimension
 */
export function createLensForce(
  cards: SemanticCard[],
  relations: CardRelation[],
  lens: string,
  strength: number
): ForceFunction {
  let nodes: SimNode[] = []

  const cardById = new Map(cards.map((c) => [c.id, c]))
  const attractionTargets = buildAttractionTargets(cards, relations, lens, cardById)

  const force: ForceFunction = (alpha: number) => {
    applyLensAttraction(nodes, attractionTargets, cardById, alpha, strength)
  }

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes
  }

  return force
}

type AttractionMap = Map<string, { x: number; y: number; count: number }>

function buildAttractionTargets(
  cards: SemanticCard[],
  relations: CardRelation[],
  lens: string,
  cardById: Map<string, SemanticCard>
): Map<string, string> {
  if (lens === 'by_topic') {
    return buildTopicAttractions(cards)
  }
  // Any other lens value is treated as a dimension key
  return buildHubAttractions(relations, cardById, lens)
}

function buildTopicAttractions(cards: SemanticCard[]): Map<string, string> {
  const docToCluster = new Map<string, string>()
  const clusters = cards.filter((c) => c.kind === CardKind.Cluster)

  for (const cluster of clusters) {
    for (const docId of cluster.clusterDocIds ?? []) {
      docToCluster.set(docId, cluster.id)
    }
  }
  return docToCluster
}

function buildHubAttractions(
  relations: CardRelation[],
  cardById: Map<string, SemanticCard>,
  dimensionKey: string
): Map<string, string> {
  const docToHub = new Map<string, string>()

  for (const rel of relations) {
    const source = cardById.get(rel.sourceId)
    const target = cardById.get(rel.targetId)
    if (source?.kind === CardKind.Hub && source.hubCategory === dimensionKey) {
      docToHub.set(rel.targetId, rel.sourceId)
    } else if (target?.kind === CardKind.Hub && target.hubCategory === dimensionKey) {
      docToHub.set(rel.sourceId, rel.targetId)
    }
  }
  return docToHub
}

function applyLensAttraction(
  nodes: SimNode[],
  docToTarget: Map<string, string>,
  cardById: Map<string, SemanticCard>,
  alpha: number,
  strength: number
): void {
  const centroids = computeTargetCentroids(nodes, docToTarget)

  for (const node of nodes) {
    const nodeId = node.id ?? ''
    const card = cardById.get(nodeId)
    if (!card || card.kind === CardKind.Hub || card.kind === CardKind.Cluster) continue

    const targetId = docToTarget.get(nodeId)
    if (!targetId) continue

    const centroid = centroids.get(targetId)
    if (!centroid) continue

    const dx = centroid.x - (node.x ?? 0)
    const dy = centroid.y - (node.y ?? 0)
    node.vx = (node.vx ?? 0) + dx * alpha * strength
    node.vy = (node.vy ?? 0) + dy * alpha * strength
  }
}

function computeTargetCentroids(
  nodes: SimNode[],
  docToTarget: Map<string, string>
): AttractionMap {
  const centroids: AttractionMap = new Map()

  for (const node of nodes) {
    const nodeId = node.id ?? ''
    if (!centroids.has(nodeId)) {
      centroids.set(nodeId, { x: node.x ?? 0, y: node.y ?? 0, count: 1 })
    }
  }

  for (const node of nodes) {
    const targetId = docToTarget.get(node.id ?? '')
    if (!targetId) continue
    const entry = centroids.get(targetId) ?? { x: 0, y: 0, count: 0 }
    entry.x += node.x ?? 0
    entry.y += node.y ?? 0
    entry.count++
    centroids.set(targetId, entry)
  }

  for (const entry of centroids.values()) {
    if (entry.count > 0) {
      entry.x /= entry.count
      entry.y /= entry.count
    }
  }

  return centroids
}
