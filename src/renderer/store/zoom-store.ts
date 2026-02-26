import { create } from 'zustand'

interface ZoomState {
  level: number
  setLevel: (level: number) => void
}

export const useZoomStore = create<ZoomState>((set) => ({
  level: 0,
  setLevel: (level) => set({ level })
}))
