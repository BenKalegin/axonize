import { create } from 'zustand'
import type { SemanticCard, CardRelation, SemanticProgress } from '../../core/semantic/types'
import { computeRadialLayout } from '../../core/semantic/radial-layout'
import type { PositionedCard } from '../../core/semantic/radial-layout'

interface GraphState {
  cards: SemanticCard[]
  relations: CardRelation[]
  focusCardId: string | null
  zoomLevel: number
  positionedCards: PositionedCard[]
  isLoading: boolean
  progress: SemanticProgress | null
  loadSemanticData: (cards: SemanticCard[], relations: CardRelation[]) => void
  setProgress: (progress: SemanticProgress | null) => void
  ensureLoaded: (vaultPath: string) => Promise<void>
  buildIndex: (vaultPath: string) => Promise<void>
  setFocus: (cardId: string) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomTo: (level: number) => void
  clear: () => void
}

function maxDepth(cards: SemanticCard[]): number {
  if (cards.length === 0) return 0
  return Math.max(...cards.map((c) => c.level))
}

function recomputeLayout(state: Pick<GraphState, 'cards' | 'relations' | 'focusCardId' | 'zoomLevel'>): PositionedCard[] {
  if (!state.focusCardId || state.cards.length === 0) return []
  return computeRadialLayout(state.focusCardId, state.cards, state.relations, state.zoomLevel)
}

export const useGraphStore = create<GraphState>((set, get) => ({
  cards: [],
  relations: [],
  focusCardId: null,
  zoomLevel: 0,
  positionedCards: [],
  isLoading: false,
  progress: null,

  loadSemanticData: (cards, relations) => {
    const level0 = cards.find((c) => c.level === 0)
    const focusCardId = level0?.id ?? null
    const positioned = computeRadialLayout(focusCardId ?? '', cards, relations, 0)
    set({ cards, relations, focusCardId, zoomLevel: 0, positionedCards: positioned })
  },

  setProgress: (progress) => set({ progress }),

  ensureLoaded: async (vaultPath) => {
    const { cards, isLoading } = get()
    if (cards.length > 0 || isLoading) return
    set({ isLoading: true })
    try {
      const data = await window.axonize.semantic.load(vaultPath)
      if (data.cards.length > 0) {
        get().loadSemanticData(data.cards, data.relations)
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
        get().loadSemanticData(data.cards, data.relations)
      }
      console.log('[semantic] Build complete,', data.cards.length, 'cards')
    } catch (err) {
      console.error('[semantic] Build failed:', err)
    }
    set({ isLoading: false })
  },

  setFocus: (cardId) => {
    const { cards, relations } = get()
    const card = cards.find((c) => c.id === cardId)
    const zoomLevel = card?.level ?? 0
    const positioned = computeRadialLayout(cardId, cards, relations, zoomLevel)
    set({ focusCardId: cardId, zoomLevel, positionedCards: positioned })
  },

  zoomIn: () => {
    const state = get()
    const max = maxDepth(state.cards)
    const newLevel = Math.min(state.zoomLevel + 0.2, max)
    const positioned = recomputeLayout({ ...state, zoomLevel: newLevel })
    set({ zoomLevel: newLevel, positionedCards: positioned })
  },

  zoomOut: () => {
    const state = get()
    const newLevel = Math.max(state.zoomLevel - 0.2, -1)
    const positioned = recomputeLayout({ ...state, zoomLevel: newLevel })
    set({ zoomLevel: newLevel, positionedCards: positioned })
  },

  zoomTo: (level) => {
    const state = get()
    const positioned = recomputeLayout({ ...state, zoomLevel: level })
    set({ zoomLevel: level, positionedCards: positioned })
  },

  clear: () => set({
    cards: [],
    relations: [],
    focusCardId: null,
    zoomLevel: 0,
    positionedCards: [],
    isLoading: false,
    progress: null
  })
}))
