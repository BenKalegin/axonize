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
 * - lens='by_topic': docs attract toward their cluster card
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

function buildAttractionTargets(
  cards: SemanticCard[],
  relations: CardRelation[],
  lens: string,
  cardById: Map<string, SemanticCard>
): Map<string, string> {
  if (lens === 'by_topic') {
    return buildTopicAttractions(cards)
  }
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
  const targetPos = buildTargetPositions(nodes)

  for (const node of nodes) {
    const nodeId = node.id ?? ''
    const card = cardById.get(nodeId)
    if (!card || card.kind === CardKind.Hub || card.kind === CardKind.Cluster) continue

    const targetId = docToTarget.get(nodeId)
    if (!targetId) continue

    const pos = targetPos.get(targetId)
    if (!pos) continue

    const dx = pos.x - (node.x ?? 0)
    const dy = pos.y - (node.y ?? 0)
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      node.vx = (node.vx ?? 0) + dx * alpha * strength
      node.vy = (node.vy ?? 0) + dy * alpha * strength
    }
  }
}

function buildTargetPositions(nodes: SimNode[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    pos.set(node.id ?? '', { x: node.x ?? 0, y: node.y ?? 0 })
  }
  return pos
}
