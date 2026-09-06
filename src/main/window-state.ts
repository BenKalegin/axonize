import { app, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, unlinkSync } from 'fs'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized?: boolean
}

export interface WindowSession {
  state: WindowState
  vaultPath: string | null
}

interface SessionsFile {
  windows: WindowSession[]
}

const DEFAULTS: WindowState = { width: 1200, height: 800 }
const TEMP_SUFFIX = '.tmp'

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function sessionsPath(): string {
  return join(app.getPath('userData'), 'window-sessions.json')
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

// Multi-window session persistence
function validateBounds(state: WindowState): WindowState {
  if (state.x !== undefined && state.y !== undefined) {
    const visible = screen.getAllDisplays().some((d) => {
      const { x, y, width, height } = d.bounds
      return state.x! >= x - 100 && state.x! < x + width &&
             state.y! >= y - 100 && state.y! < y + height
    })
    if (!visible) {
      return { width: state.width || DEFAULTS.width, height: state.height || DEFAULTS.height }
    }
  }
  return state
}

export function loadWindowSessions(): WindowSession[] {
  try {
    const data = JSON.parse(readFileSync(sessionsPath(), 'utf-8')) as SessionsFile
    if (!data.windows || !Array.isArray(data.windows)) return []
    // Validate and filter sessions
    return data.windows.map((session) => ({
      state: validateBounds(session.state),
      vaultPath: session.vaultPath
    }))
  } catch {
    return []
  }
}

export function saveWindowSessions(sessions: WindowSession[]): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    const filePath = sessionsPath()
    const tempPath = `${filePath}${TEMP_SUFFIX}`
    const data: SessionsFile = { windows: sessions }
    writeFileSync(tempPath, JSON.stringify(data, null, 2))
    renameSync(tempPath, filePath)
  } catch {
    // ignore write errors
  }
}

export function clearWindowSessions(): void {
  try {
    const filePath = sessionsPath()
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  } catch {
    // ignore errors
  }
}
