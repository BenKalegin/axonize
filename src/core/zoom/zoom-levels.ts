export type ZoomLevel = 'Z0' | 'Z1' | 'Z2' | 'Z3' | 'Z4'

export const ZOOM_LEVELS: ZoomLevel[] = ['Z0', 'Z1', 'Z2', 'Z3', 'Z4']

export interface ZoomConfig {
  level: ZoomLevel
  showLabels: boolean
  showCards: boolean
  showContent: boolean
  showFullText: boolean
  nodeSize: number
}

export function getZoomConfig(level: ZoomLevel): ZoomConfig {
  switch (level) {
    case 'Z0':
      return { level, showLabels: false, showCards: false, showContent: false, showFullText: false, nodeSize: 3 }
    case 'Z1':
      return { level, showLabels: true, showCards: false, showContent: false, showFullText: false, nodeSize: 5 }
    case 'Z2':
      return { level, showLabels: true, showCards: true, showContent: false, showFullText: false, nodeSize: 8 }
    case 'Z3':
      return { level, showLabels: true, showCards: true, showContent: true, showFullText: false, nodeSize: 12 }
    case 'Z4':
      return { level, showLabels: true, showCards: true, showContent: true, showFullText: true, nodeSize: 16 }
  }
}
