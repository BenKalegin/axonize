import { app, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized?: boolean
}

const DEFAULTS: WindowState = { width: 1200, height: 800 }

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    const data = JSON.parse(readFileSync(statePath(), 'utf-8')) as WindowState
    // Validate bounds are on a visible display
    if (data.x !== undefined && data.y !== undefined) {
      const visible = screen.getAllDisplays().some((d) => {
        const { x, y, width, height } = d.bounds
        return data.x! >= x - 100 && data.x! < x + width &&
               data.y! >= y - 100 && data.y! < y + height
      })
      if (!visible) {
        return { width: data.width || DEFAULTS.width, height: data.height || DEFAULTS.height }
      }
    }
    return {
      x: data.x,
      y: data.y,
      width: data.width || DEFAULTS.width,
      height: data.height || DEFAULTS.height,
      maximized: data.maximized
    }
  } catch {
    return DEFAULTS
  }
}

export function saveWindowState(state: WindowState): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    writeFileSync(statePath(), JSON.stringify(state))
  } catch {
    // ignore write errors
  }
}
