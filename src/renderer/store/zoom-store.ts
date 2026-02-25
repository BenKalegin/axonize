import { create } from 'zustand'

export type ZoomLevel = 'Z0' | 'Z1' | 'Z2' | 'Z3' | 'Z4'

export const ZOOM_LEVELS: ZoomLevel[] = ['Z0', 'Z1', 'Z2', 'Z3', 'Z4']

interface ZoomState {
  level: ZoomLevel
  setLevel: (level: ZoomLevel) => void
}

export const useZoomStore = create<ZoomState>((set) => ({
  level: 'Z1',
  setLevel: (level) => set({ level })
}))
