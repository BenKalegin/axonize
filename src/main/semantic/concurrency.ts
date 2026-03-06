/**
 * Bounded-concurrency pool for async tasks with per-task watchdog timeout.
 *
 * Returns results in input order. If a single task exceeds `taskTimeoutMs`,
 * its promise rejects with a timeout error — the caller's per-item error
 * handler can catch it without killing the whole pool.
 */
export async function poolMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
  taskTimeoutMs: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++
      const timeout = new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error(`Task ${idx} timed out after ${taskTimeoutMs}ms`)),
          taskTimeoutMs
        )
      })
      try {
        const value = await Promise.race([fn(items[idx], idx), timeout])
        results[idx] = { status: 'fulfilled', value }
      } catch (reason) {
        results[idx] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext())
  await Promise.all(workers)
  return results
}
