import { create } from 'zustand'
import type { UILayoutConfig } from '@core/rag/types'

export const SidePanelId = {
  Files: 'files',
  Git: 'git',
  Outline: 'outline',
  Agent: 'agent',
  LlmLog: 'llm-log',
  Errors: 'errors'
} as const
export type SidePanelId = (typeof SidePanelId)[keyof typeof SidePanelId]

export const RightPanelId = {
  Properties: 'properties',
  Related: 'related'
} as const
export type RightPanelId = (typeof RightPanelId)[keyof typeof RightPanelId]

export const ACTIVITY_BAR_WIDTH = 48
const MIN_PANEL_WIDTH = 160
const MAX_PANEL_WIDTH_FALLBACK = 1400
const MAX_PANEL_WIDTH_VIEWPORT_RATIO = 0.75
const DEFAULT_PANEL_WIDTH = 220
const DEFAULT_RIGHT_PANEL_WIDTH = 260

function maxPanelWidth(): number {
  if (typeof window === 'undefined') return MAX_PANEL_WIDTH_FALLBACK
  return Math.max(MIN_PANEL_WIDTH, Math.floor(window.innerWidth * MAX_PANEL_WIDTH_VIEWPORT_RATIO))
}

interface LayoutState {
  activePanelId: SidePanelId | null
  activeRightPanelId: RightPanelId | null
  sidePanelWidth: number
  rightPanelWidth: number
  rightDrawerOpen: boolean
  togglePanel: (id: SidePanelId) => void
  toggleRightPanel: (id: RightPanelId) => void
  setSidePanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  toggleRightDrawer: () => void
  hydrateFromSettings: () => Promise<void>
  persistToSettings: () => Promise<void>
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  activePanelId: SidePanelId.Files,
  activeRightPanelId: null,
  sidePanelWidth: DEFAULT_PANEL_WIDTH,
  rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
  rightDrawerOpen: false,

  togglePanel: (id) =>
    set((s) => ({
      activePanelId: s.activePanelId === id ? null : id
    })),

  toggleRightPanel: (id) =>
    set((s) => ({
      activeRightPanelId: s.activeRightPanelId === id ? null : id
    })),

  setSidePanelWidth: (w) =>
    set({ sidePanelWidth: Math.min(maxPanelWidth(), Math.max(MIN_PANEL_WIDTH, w)) }),

  setRightPanelWidth: (w) =>
    set({ rightPanelWidth: Math.min(maxPanelWidth(), Math.max(MIN_PANEL_WIDTH, w)) }),

  toggleRightDrawer: () =>
    set((s) => ({ rightDrawerOpen: !s.rightDrawerOpen })),

  hydrateFromSettings: async () => {
    try {
      const settings = (await window.axonize.settings.get()) as {
        ui?: UILayoutConfig & { activeRightPanelId?: string }
      }
      if (settings?.ui) {
        set({
          activePanelId: (settings.ui.activePanelId as SidePanelId | null) ?? SidePanelId.Files,
          activeRightPanelId: null, // Always start with properties panel collapsed
          sidePanelWidth: Math.min(
            maxPanelWidth(),
            Math.max(MIN_PANEL_WIDTH, settings.ui.sidePanelWidth ?? DEFAULT_PANEL_WIDTH)
          ),
          rightDrawerOpen: false
        })
      }
    } catch {
      // use defaults
    }
  },

  persistToSettings: async () => {
    try {
      const { activePanelId, activeRightPanelId, sidePanelWidth, rightDrawerOpen } = get()
      const settings = (await window.axonize.settings.get()) as Record<string, unknown>
      await window.axonize.settings.save({
        ...settings,
        ui: { activePanelId, activeRightPanelId, sidePanelWidth, rightDrawerOpen }
      })
    } catch {
      // ignore
    }
  }
}))
