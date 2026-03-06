import { create } from 'zustand'
import type { UILayoutConfig } from '../../core/rag/types'

export type SidePanelId = 'files' | 'llm-log' | 'errors'

export const ACTIVITY_BAR_WIDTH = 48
const MIN_PANEL_WIDTH = 160
const MAX_PANEL_WIDTH = 600
const DEFAULT_PANEL_WIDTH = 220
const DEFAULT_RIGHT_PANEL_WIDTH = 260

interface LayoutState {
  activePanelId: SidePanelId | null
  sidePanelWidth: number
  rightPanelWidth: number
  rightDrawerOpen: boolean
  togglePanel: (id: SidePanelId) => void
  setSidePanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  toggleRightDrawer: () => void
  hydrateFromSettings: () => Promise<void>
  persistToSettings: () => Promise<void>
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  activePanelId: 'files',
  sidePanelWidth: DEFAULT_PANEL_WIDTH,
  rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
  rightDrawerOpen: true,

  togglePanel: (id) =>
    set((s) => ({
      activePanelId: s.activePanelId === id ? null : id
    })),

  setSidePanelWidth: (w) =>
    set({ sidePanelWidth: Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w)) }),

  setRightPanelWidth: (w) =>
    set({ rightPanelWidth: Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w)) }),

  toggleRightDrawer: () =>
    set((s) => ({ rightDrawerOpen: !s.rightDrawerOpen })),

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
          ),
          rightDrawerOpen: (settings.ui as unknown as Record<string, unknown>).rightDrawerOpen !== false
        })
      }
    } catch {
      // use defaults
    }
  },

  persistToSettings: async () => {
    try {
      const { activePanelId, sidePanelWidth, rightDrawerOpen } = get()
      const settings = (await window.axonize.settings.get()) as Record<string, unknown>
      await window.axonize.settings.save({
        ...settings,
        ui: { activePanelId, sidePanelWidth, rightDrawerOpen }
      })
    } catch {
      // ignore
    }
  }
}))
