import { watch, type FSWatcher } from 'fs'
import { basename, extname } from 'path'
import type { BrowserWindow } from 'electron'
import log from './logger'

const DEBOUNCE_MS = 1000
const IGNORED_DIRS = new Set(['.axonize', 'node_modules', '.git'])

let watcher: FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function isIgnored(filename: string): boolean {
  const parts = filename.split('/')
  return parts.some((part) => IGNORED_DIRS.has(part))
}

function isMarkdown(filename: string): boolean {
  return extname(basename(filename)) === '.md'
}

export function startWatching(vaultPath: string, window: BrowserWindow): void {
  stopWatching()

  try {
    watcher = watch(vaultPath, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      if (isIgnored(filename)) return
      if (!isMarkdown(filename)) return

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (window && !window.isDestroyed()) {
          window.webContents.send('vault:filesChanged')
        }
      }, DEBOUNCE_MS)
    })

    watcher.on('error', (err) => {
      log.error('[file-watcher] Error:', err)
    })

    log.info(`[file-watcher] Watching ${vaultPath}`)
  } catch (err) {
    log.error('[file-watcher] Failed to start:', err)
  }
}

export function stopWatching(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (watcher) {
    watcher.close()
    watcher = null
    log.info('[file-watcher] Stopped')
  }
}
