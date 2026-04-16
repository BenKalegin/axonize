import { stat } from 'fs/promises'
import log from '../logger'

/**
 * File state cache for agent sessions
 * Based on Claude Code's file caching pattern
 */

interface CachedFile {
  content: string
  mtimeMs: number
  sizeBytes: number
}

export class FileStateCache {
  private cache = new Map<string, CachedFile>()
  private maxCacheSize: number // in bytes

  constructor(maxCacheSize = 50 * 1024 * 1024) {
    // 50MB default
    this.maxCacheSize = maxCacheSize
  }

  /**
   * Get cached file content if still fresh
   */
  async get(filePath: string): Promise<string | null> {
    const cached = this.cache.get(filePath)
    if (!cached) {
      return null
    }

    try {
      // Check if file has been modified since cache
      const stats = await stat(filePath)
      if (stats.mtimeMs > cached.mtimeMs) {
        // File modified, invalidate cache
        this.cache.delete(filePath)
        return null
      }

      return cached.content
    } catch (error) {
      // File might have been deleted
      this.cache.delete(filePath)
      return null
    }
  }

  /**
   * Set file content in cache
   */
  set(filePath: string, content: string, mtimeMs: number, sizeBytes: number): void {
    // Check if adding this file would exceed cache size
    const currentSize = this.getCacheSize()
    if (currentSize + sizeBytes > this.maxCacheSize) {
      // Evict oldest entries until we have space
      this.evictLRU(sizeBytes)
    }

    this.cache.set(filePath, {
      content,
      mtimeMs,
      sizeBytes
    })
  }

  /**
   * Check if file is cached and fresh
   */
  async has(filePath: string): Promise<boolean> {
    const content = await this.get(filePath)
    return content !== null
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Remove specific file from cache
   */
  delete(filePath: string): void {
    this.cache.delete(filePath)
  }

  /**
   * Get total cache size in bytes
   */
  getCacheSize(): number {
    return Array.from(this.cache.values()).reduce((sum, file) => sum + file.sizeBytes, 0)
  }

  /**
   * Get number of cached files
   */
  getFileCount(): number {
    return this.cache.size
  }

  /**
   * Evict least recently used entries to make space
   */
  private evictLRU(requiredSpace: number): void {
    // Simple eviction: remove oldest entries by mtime
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.mtimeMs - b.mtimeMs
    )

    let freedSpace = 0
    for (const [path, file] of entries) {
      if (freedSpace >= requiredSpace) {
        break
      }
      this.cache.delete(path)
      freedSpace += file.sizeBytes
      log.debug(`Evicted ${path} from cache (${file.sizeBytes} bytes)`)
    }
  }

  /**
   * Clone cache with size limit (for sub-agents)
   */
  clone(maxSize?: number): FileStateCache {
    const newCache = new FileStateCache(maxSize || this.maxCacheSize)

    // Copy entries up to size limit
    let totalSize = 0
    for (const [path, file] of this.cache.entries()) {
      if (maxSize && totalSize + file.sizeBytes > maxSize) {
        break
      }
      newCache.cache.set(path, { ...file })
      totalSize += file.sizeBytes
    }

    return newCache
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    fileCount: number
    totalSize: number
    maxSize: number
    utilizationPercent: number
  } {
    const totalSize = this.getCacheSize()
    return {
      fileCount: this.cache.size,
      totalSize,
      maxSize: this.maxCacheSize,
      utilizationPercent: (totalSize / this.maxCacheSize) * 100
    }
  }
}

/**
 * Session-scoped cache management
 */
class SessionCacheManager {
  private sessionCaches = new Map<string, FileStateCache>()

  getCache(sessionId: string): FileStateCache {
    if (!this.sessionCaches.has(sessionId)) {
      this.sessionCaches.set(sessionId, new FileStateCache())
    }
    return this.sessionCaches.get(sessionId)!
  }

  deleteCache(sessionId: string): void {
    const cache = this.sessionCaches.get(sessionId)
    if (cache) {
      cache.clear()
      this.sessionCaches.delete(sessionId)
    }
  }

  clearAll(): void {
    for (const cache of this.sessionCaches.values()) {
      cache.clear()
    }
    this.sessionCaches.clear()
  }

  getAllStats(): Map<string, ReturnType<FileStateCache['getStats']>> {
    const stats = new Map<string, ReturnType<FileStateCache['getStats']>>()
    for (const [sessionId, cache] of this.sessionCaches.entries()) {
      stats.set(sessionId, cache.getStats())
    }
    return stats
  }
}

// Global session cache manager
export const sessionCacheManager = new SessionCacheManager()
