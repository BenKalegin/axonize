import { create } from 'zustand'
import type { UILayoutConfig } from '../../core/rag/types'

export type SidePanelId = 'files' | 'llm-log'

export const ACTIVITY_BAR_WIDTH = 48
const MIN_PANEL_WIDTH = 160
const MAX_PANEL_WIDTH = 600
const DEFAULT_PANEL_WIDTH = 220
const DEFAULT_RIGHT_PANEL_WIDTH = 260

interface LayoutState {
  activePanelId: SidePanelId | null
  sidePanelWidth: number
  rightPanelWidth: number
  togglePanel: (id: SidePanelId) => void
  setSidePanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  hydrateFromSettings: () => Promise<void>
  persistToSettings: () => Promise<void>
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  activePanelId: 'files',
  sidePanelWidth: DEFAULT_PANEL_WIDTH,
  rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,

  togglePanel: (id) =>
    set((s) => ({
      activePanelId: s.activePanelId === id ? null : id
    })),

  setSidePanelWidth: (w) =>
    set({ sidePanelWidth: Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w)) }),

  setRightPanelWidth: (w) =>
    set({ rightPanelWidth: Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w)) }),

  hydrateFromSettings: async () => {
    try {
      const settings = (await window.axonize.settings.get()) as {
        ui?: UILayoutConfig
      }
      if (settings?.ui) {
        set({
          activePanelId: (settings.ui.activePanelId as SidePanelId | null) ?? 'files',
          sidePanelWidth: Math.min(
            MAX_PANEL_WIDTH,
            Math.max(MIN_PANEL_WIDTH, settings.ui.sidePanelWidth ?? DEFAULT_PANEL_WIDTH)
          )
        })
      }
    } catch {
      // use defaults
    }
  },

  persistToSettings: async () => {
    try {
      const { activePanelId, sidePanelWidth } = get()
      const settings = (await window.axonize.settings.get()) as Record<string, unknown>
      await window.axonize.settings.save({
        ...settings,
        ui: { activePanelId, sidePanelWidth }
      })
    } catch {
      // ignore
    }
  }
}))
