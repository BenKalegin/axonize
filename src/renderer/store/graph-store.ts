import { create } from 'zustand'
import type { SemanticCard, CardRelation, SemanticProgress, DimensionMeta } from '@core/semantic/types'
import { CardKind } from '@core/semantic/types'
import { resolveCardTitle } from '@core/semantic/title-utils'

export type VisibleDepth = -1 | 0 | 1 | 2

interface GraphState {
  cards: SemanticCard[]
  relations: CardRelation[]
  dimensions: DimensionMeta[]
  visibleDepth: VisibleDepth
  activeLens: string
  hoveredNodeId: string | null
  focusedDocId: string | null
  isLoading: boolean
  progress: SemanticProgress | null
  loadSemanticData: (cards: SemanticCard[], relations: CardRelation[], dimensions: DimensionMeta[]) => void
  setProgress: (progress: SemanticProgress | null) => void
  ensureLoaded: (vaultPath: string) => Promise<void>
  buildIndex: (vaultPath: string) => Promise<void>
  increaseDepth: () => void
  decreaseDepth: () => void
  setDepth: (depth: VisibleDepth) => void
  setLens: (lens: string) => void
  setHoveredNode: (nodeId: string | null) => void
  focusDoc: (docId: string | null) => void
  clear: () => void
}

function resolveCardTitles(cards: SemanticCard[]): SemanticCard[] {
  return cards.map((c) => ({
    ...c,
    title: resolveCardTitle(c.title, c.filePath, c.level)
  }))
}

export function visibleCards(cards: SemanticCard[], depth: VisibleDepth, focusedDocId: string | null): SemanticCard[] {
  const focusedSubtree = focusedDocId ? collectSubtreeIds(cards, focusedDocId) : null

  return cards.filter((c) => {
    const kind = c.kind ?? CardKind.Doc
    if (kind === CardKind.Cluster) return depth === -1
    if (kind === CardKind.Hub) return depth <= 0 && !focusedSubtree
    if (focusedSubtree && c.level > 0) return focusedSubtree.has(c.id)
    return c.level <= depth
  })
}

function collectSubtreeIds(cards: SemanticCard[], rootId: string): Set<string> {
  const ids = new Set<string>()
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.pop()!
    ids.add(id)
    for (const c of cards) {
      if (c.parentId === id && !ids.has(c.id)) queue.push(c.id)
    }
  }
  return ids
}

export function visibleRelations(
  relations: CardRelation[],
  cardIds: Set<string>
): CardRelation[] {
  return relations.filter((r) => cardIds.has(r.sourceId) && cardIds.has(r.targetId))
}

export const useGraphStore = create<GraphState>((set, get) => ({
  cards: [],
  relations: [],
  dimensions: [],
  visibleDepth: 0,
  activeLens: 'by_topic',
  hoveredNodeId: null,
  focusedDocId: null,
  isLoading: false,
  progress: null,

  loadSemanticData: (rawCards, relations, dimensions = []) => {
    const cards = resolveCardTitles(rawCards)
    set({ cards, relations, dimensions, visibleDepth: 0, hoveredNodeId: null, focusedDocId: null, activeLens: 'by_topic' })
  },

  setProgress: (progress) => set({ progress }),

  ensureLoaded: async (vaultPath) => {
    const { cards, isLoading } = get()
    if (cards.length > 0 || isLoading) return
    set({ isLoading: true })
    try {
      const data = await window.axonize.semantic.load(vaultPath)
      if (data.cards.length > 0) {
        get().loadSemanticData(data.cards, data.relations, data.dimensions ?? [])
      }
    } catch { /* no cache available */ }
    set({ isLoading: false })
  },

  buildIndex: async (vaultPath) => {
    set({ isLoading: true })
    try {
      console.log('[semantic] Building index for', vaultPath)
      await window.axonize.semantic.build(vaultPath)
      const data = await window.axonize.semantic.load(vaultPath)
      if (data.cards.length > 0) {
        get().loadSemanticData(data.cards, data.relations, data.dimensions ?? [])
      }
      console.log('[semantic] Build complete,', data.cards.length, 'cards')
    } catch (err) {
      console.error('[semantic] Build failed:', err)
    }
    set({ isLoading: false })
  },

  increaseDepth: () => {
    const { visibleDepth } = get()
    if (visibleDepth < 2) set({ visibleDepth: (visibleDepth + 1) as VisibleDepth })
  },

  decreaseDepth: () => {
    const { visibleDepth } = get()
    if (visibleDepth > -1) {
      const newDepth = (visibleDepth - 1) as VisibleDepth
      set({ visibleDepth: newDepth, focusedDocId: newDepth <= 0 ? null : get().focusedDocId })
    }
  },

  setDepth: (depth) => set({ visibleDepth: depth, focusedDocId: depth <= 0 ? null : get().focusedDocId }),

  setLens: (lens) => set({ activeLens: lens }),

  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),

  focusDoc: (docId) => set({ focusedDocId: docId }),

  clear: () => set({
    cards: [],
    relations: [],
    dimensions: [],
    visibleDepth: 0,
    activeLens: 'by_topic',
    hoveredNodeId: null,
    focusedDocId: null,
    isLoading: false,
    progress: null
  })
}))
