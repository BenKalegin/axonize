import type { SemanticCard, CardRelation } from './types'

export interface PositionedCard {
  card: SemanticCard
  x: number
  y: number
  scale: number
  opacity: number
}

const ORBIT_RADIUS = 220
const OUTER_ORBIT_RADIUS = 380

function placeOnOrbit(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number,
  scale: number,
  opacity: number,
  card: SemanticCard
): PositionedCard {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  return {
    card,
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
    scale,
    opacity
  }
}

function findCard(cards: SemanticCard[], id: string): SemanticCard | undefined {
  return cards.find((c) => c.id === id)
}

function childrenOf(cards: SemanticCard[], parentId: string): SemanticCard[] {
  return cards.filter((c) => c.parentId === parentId)
}

function siblingsOf(cards: SemanticCard[], card: SemanticCard): SemanticCard[] {
  if (!card.parentId) {
    return cards.filter((c) => c.level === card.level && c.id !== card.id)
  }
  return cards.filter((c) => c.parentId === card.parentId && c.id !== card.id)
}

function crossDocCards(cards: SemanticCard[], focusFilePath: string): SemanticCard[] {
  return cards.filter((c) => c.level === 0 && c.filePath !== focusFilePath)
}

export function computeRadialLayout(
  focusCardId: string,
  cards: SemanticCard[],
  _relations: CardRelation[],
  zoomLevel: number
): PositionedCard[] {
  const focus = findCard(cards, focusCardId)
  if (!focus) return []

  const result: PositionedCard[] = []
  const discreteLevel = Math.floor(zoomLevel)
  const fraction = zoomLevel - discreteLevel

  // Center card
  const centerScale = 1.0 - fraction * 0.3
  const centerOpacity = 1.0 - fraction * 0.4
  result.push({ card: focus, x: 0, y: 0, scale: centerScale, opacity: centerOpacity })

  if (zoomLevel < 0) {
    // Zoomed out beyond doc level — show cross-doc cards
    const crossDocs = crossDocCards(cards, focus.filePath)
    for (let i = 0; i < crossDocs.length; i++) {
      result.push(placeOnOrbit(0, 0, ORBIT_RADIUS, i, crossDocs.length, 0.7, 1.0, crossDocs[i]))
    }
    return result
  }

  // Children of focus card on inner orbit
  const children = childrenOf(cards, focusCardId)
  const childOpacity = Math.min(1, fraction * 2.5)

  if (children.length > 0 && fraction > 0) {
    for (let i = 0; i < children.length; i++) {
      result.push(placeOnOrbit(
        0, 0, ORBIT_RADIUS * (0.5 + fraction * 0.5),
        i, children.length,
        0.6 + fraction * 0.2,
        childOpacity,
        children[i]
      ))
    }
  } else if (discreteLevel >= 1) {
    // At integer level: show siblings on orbit + parent at center awareness
    const siblings = siblingsOf(cards, focus)
    for (let i = 0; i < siblings.length; i++) {
      result.push(placeOnOrbit(0, 0, ORBIT_RADIUS, i, siblings.length, 0.7, 0.8, siblings[i]))
    }
    // Show children fading in
    if (children.length > 0 && fraction > 0) {
      for (let i = 0; i < children.length; i++) {
        result.push(placeOnOrbit(
          0, 0, ORBIT_RADIUS * 0.5,
          i, children.length,
          0.5 * fraction,
          fraction,
          children[i]
        ))
      }
    }
  }

  // Cross-doc cards on outer orbit at level 0
  if (zoomLevel < 1) {
    const crossDocs = crossDocCards(cards, focus.filePath)
    const crossOpacity = Math.max(0, 1 - zoomLevel)
    if (crossOpacity > 0 && crossDocs.length > 0) {
      for (let i = 0; i < crossDocs.length; i++) {
        result.push(placeOnOrbit(0, 0, OUTER_ORBIT_RADIUS, i, crossDocs.length, 0.5, crossOpacity, crossDocs[i]))
      }
    }
  }

  return result
}
