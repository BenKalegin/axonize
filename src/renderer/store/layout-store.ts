import { create } from 'zustand'
import type { UILayoutConfig } from '@core/rag/types'

export type SidePanelId = 'files' | 'git' | 'outline' | 'llm-log' | 'errors' | 'agent'
export type RightPanelId = 'properties' | 'related'

export const ACTIVITY_BAR_WIDTH = 48
const MIN_PANEL_WIDTH = 160
const MAX_PANEL_WIDTH = 600
const DEFAULT_PANEL_WIDTH = 220
const DEFAULT_RIGHT_PANEL_WIDTH = 260

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
  activePanelId: 'files',
  activeRightPanelId: 'properties',
  sidePanelWidth: DEFAULT_PANEL_WIDTH,
  rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
  rightDrawerOpen: true,

  togglePanel: (id) =>
    set((s) => ({
      activePanelId: s.activePanelId === id ? null : id
    })),

  toggleRightPanel: (id) =>
    set((s) => ({
      activeRightPanelId: s.activeRightPanelId === id ? null : id
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
        ui?: UILayoutConfig & { activeRightPanelId?: string }
      }
      if (settings?.ui) {
        set({
          activePanelId: (settings.ui.activePanelId as SidePanelId | null) ?? 'files',
          activeRightPanelId: (settings.ui.activeRightPanelId as RightPanelId | null) ?? 'properties',
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
