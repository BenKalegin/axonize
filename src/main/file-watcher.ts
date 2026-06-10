import { watch, type FSWatcher } from 'fs'
import { basename } from 'path'
import type { BrowserWindow } from 'electron'
import { isVaultVisibleFile } from '../core/vault/data-file-types'
import log from './logger'

const DEBOUNCE_MS = 1000
const IGNORED_DIRS = new Set(['.axonize', 'node_modules', '.git'])

interface WatcherEntry {
  watcher: FSWatcher
  timer: ReturnType<typeof setTimeout> | null
}

const watchers = new Map<number, WatcherEntry>()

function isIgnored(filename: string): boolean {
  const parts = filename.split(/[\\/]/)
  return parts.some((part) => IGNORED_DIRS.has(part))
}

function isWatchedFile(filename: string): boolean {
  return isVaultVisibleFile(basename(filename))
}

export function startWatching(vaultPath: string, win: BrowserWindow): void {
  stopWatching(win.id)

  try {
    const entry: WatcherEntry = { watcher: null!, timer: null }

    entry.watcher = watch(vaultPath, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      if (isIgnored(filename)) return
      if (!isWatchedFile(filename)) return

      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        if (!win.isDestroyed()) {
          win.webContents.send('vault:filesChanged')
        }
      }, DEBOUNCE_MS)
    })

    entry.watcher.on('error', (err) => {
      log.error(`[file-watcher] Error (window ${win.id}):`, err)
    })

    watchers.set(win.id, entry)
    log.info(`[file-watcher] Watching ${vaultPath} (window ${win.id})`)
  } catch (err) {
    log.error('[file-watcher] Failed to start:', err)
  }
}

export function stopWatching(windowId: number): void {
  const entry = watchers.get(windowId)
  if (!entry) return

  if (entry.timer) clearTimeout(entry.timer)
  entry.watcher.close()
  watchers.delete(windowId)
  log.info(`[file-watcher] Stopped (window ${windowId})`)
}
