import type { DataRowResult } from '@core/data/types'

/** Rows fetched per IPC round-trip; also the cache page granularity. */
export const ROW_PAGE_SIZE = 200
/** Pages kept in the cache before old ones are dropped (FIFO). */
const MAX_CACHED_PAGES = 16

/**
 * Windowed, page-cached access to one data file's rows over IPC.
 * The renderer never holds more than MAX_CACHED_PAGES * ROW_PAGE_SIZE rows.
 */
export class IpcRowSource {
  private readonly pages = new Map<number, DataRowResult[]>()
  private readonly inFlight = new Map<number, Promise<void>>()

  constructor(private readonly filePath: string) {}

  /** Synchronous cache lookup; undefined while the page is not loaded yet. */
  rowAt(index: number): DataRowResult | undefined {
    const page = this.pages.get(Math.floor(index / ROW_PAGE_SIZE))
    return page?.[index % ROW_PAGE_SIZE]
  }

  /** Ensure all pages covering [start, end] are loaded (deduped while in flight). */
  async ensureRange(start: number, end: number): Promise<void> {
    const firstPage = Math.floor(Math.max(start, 0) / ROW_PAGE_SIZE)
    const lastPage = Math.floor(Math.max(end, 0) / ROW_PAGE_SIZE)
    const loads: Promise<void>[] = []
    for (let page = firstPage; page <= lastPage; page++) {
      if (!this.pages.has(page)) loads.push(this.loadPage(page))
    }
    await Promise.all(loads)
  }

  invalidate(): void {
    this.pages.clear()
    this.inFlight.clear()
  }

  private loadPage(page: number): Promise<void> {
    const existing = this.inFlight.get(page)
    if (existing) return existing

    const load = window.axonize.data
      .rows(this.filePath, page * ROW_PAGE_SIZE, ROW_PAGE_SIZE)
      .then((rows) => {
        this.pages.set(page, rows)
        this.evictOldPages()
      })
      .finally(() => {
        this.inFlight.delete(page)
      })
    this.inFlight.set(page, load)
    return load
  }

  private evictOldPages(): void {
    while (this.pages.size > MAX_CACHED_PAGES) {
      const oldest = this.pages.keys().next().value
      if (oldest === undefined) return
      this.pages.delete(oldest)
    }
  }
}
