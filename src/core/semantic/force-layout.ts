import type { SemanticCard } from './types'
import { CardKind } from './types'

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export interface InitialPosition {
  id: string
  x: number
  y: number
}

export interface ForceConfig {
  chargeStrength: number
  linkDistance: number
  collisionRadius: number
  clusterStrength: number
}

export function computeInitialPositions(cards: SemanticCard[]): InitialPosition[] {
  const positions: InitialPosition[] = []
  const parentPos = new Map<string, { x: number; y: number }>()

  const hubs = cards.filter((c) => c.kind === CardKind.Hub)
  const clusters = cards.filter((c) => c.kind === CardKind.Cluster)
  const docs = cards.filter((c) => c.level === 0 && c.kind !== CardKind.Hub && c.kind !== CardKind.Cluster)
  const subCards = cards.filter((c) => c.level > 0 && c.kind !== CardKind.Hub && c.kind !== CardKind.Cluster)

  placeRing(hubs, 60, positions, parentPos)
  placeRing(docs, 150, positions, parentPos)
  placeRing(clusters, 250, positions, parentPos)
  placeChildrenNearParents(subCards, parentPos, positions)

  return positions
}

function placeRing(
  items: SemanticCard[],
  baseRadius: number,
  positions: InitialPosition[],
  parentPos: Map<string, { x: number; y: number }>
): void {
  if (items.length === 0) return
  const radius = baseRadius + items.length * 5
  for (let i = 0; i < items.length; i++) {
    const angle = i * GOLDEN_ANGLE
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    positions.push({ id: items[i].id, x, y })
    parentPos.set(items[i].id, { x, y })
  }
}

function placeChildrenNearParents(
  subCards: SemanticCard[],
  parentPos: Map<string, { x: number; y: number }>,
  positions: InitialPosition[]
): void {
  const childrenByParent = new Map<string, SemanticCard[]>()
  for (const card of subCards) {
    if (!card.parentId) continue
    const group = childrenByParent.get(card.parentId) ?? []
    group.push(card)
    childrenByParent.set(card.parentId, group)
  }

  for (const [parentId, children] of childrenByParent) {
    const pPos = parentPos.get(parentId)
    const cx = pPos?.x ?? 0
    const cy = pPos?.y ?? 0
    const clusterRadius = 40 + children.length * 8

    for (let i = 0; i < children.length; i++) {
      const angle = (2 * Math.PI * i) / children.length
      const x = cx + clusterRadius * Math.cos(angle)
      const y = cy + clusterRadius * Math.sin(angle)
      positions.push({ id: children[i].id, x, y })
      parentPos.set(children[i].id, { x, y })
    }
  }
}

export function getForceConfig(nodeCount: number): ForceConfig {
  return {
    chargeStrength: -120 - nodeCount * 4,
    linkDistance: 80,
    collisionRadius: 60,
    clusterStrength: 0.4
  }
}

const LINK_DISTANCES: Record<string, number> = {
  elaboration: 60,
  example: 70,
  sequence: 80,
  dependency: 80,
  inference: 100,
  contrast: 130,
  competes_with: 130,
  implements: 90,
  specifies: 90,
  extends: 80,
  uses: 85
}

export function linkDistanceByType(type: string): number {
  return LINK_DISTANCES[type] ?? 80
}
