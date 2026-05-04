import { app } from 'electron'
import { readFile, writeFile, rename } from 'fs/promises'
import { join } from 'path'

export interface RecentVault {
  path: string
  name: string
  openedAt: number
}

const MAX_RECENT = 10
const TEMP_SUFFIX = '.tmp'
const JSON_INDENT_SPACES = 2

function getFilePath(): string {
  return join(app.getPath('userData'), 'recent-vaults.json')
}

// Serializes all mutations to recent-vaults.json so concurrent calls (e.g. from
// multiple Electron windows opening vaults at once) cannot interleave between
// the readFile/writeFile awaits and clobber each other's updates.
let pendingChain: Promise<void> = Promise.resolve()

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  // Run the next mutation regardless of whether the previous one resolved or
  // rejected; we only need the *ordering* guarantee, not error propagation.
  const next = pendingChain.then(work, work)
  pendingChain = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

export async function getRecentVaults(): Promise<RecentVault[]> {
  try {
    const data = await readFile(getFilePath(), 'utf-8')
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

// Write-then-rename: a crash mid-write only damages the .tmp file, leaving
// the previous recent-vaults.json intact. POSIX rename is atomic on the same
// filesystem.
async function save(vaults: RecentVault[]): Promise<void> {
  const filePath = getFilePath()
  const tempPath = `${filePath}${TEMP_SUFFIX}`
  await writeFile(tempPath, JSON.stringify(vaults, null, JSON_INDENT_SPACES), 'utf-8')
  await rename(tempPath, filePath)
}

export function addRecentVault(path: string, name: string): Promise<void> {
  return enqueue(async () => {
    const vaults = await getRecentVaults()
    const filtered = vaults.filter((v) => v.path !== path)
    filtered.unshift({ path, name, openedAt: Date.now() })
    await save(filtered.slice(0, MAX_RECENT))
  })
}

export function removeRecentVault(path: string): Promise<void> {
  return enqueue(async () => {
    const vaults = await getRecentVaults()
    await save(vaults.filter((v) => v.path !== path))
  })
}

export function clearRecentVaults(): Promise<void> {
  return enqueue(async () => {
    await save([])
  })
}
