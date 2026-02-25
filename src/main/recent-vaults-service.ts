import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export interface RecentVault {
  path: string
  name: string
  openedAt: number
}

const MAX_RECENT = 10

function getFilePath(): string {
  return join(app.getPath('userData'), 'recent-vaults.json')
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

async function save(vaults: RecentVault[]): Promise<void> {
  await writeFile(getFilePath(), JSON.stringify(vaults, null, 2), 'utf-8')
}

export async function addRecentVault(path: string, name: string): Promise<void> {
  const vaults = await getRecentVaults()
  const filtered = vaults.filter((v) => v.path !== path)
  filtered.unshift({ path, name, openedAt: Date.now() })
  await save(filtered.slice(0, MAX_RECENT))
}

export async function removeRecentVault(path: string): Promise<void> {
  const vaults = await getRecentVaults()
  await save(vaults.filter((v) => v.path !== path))
}

export async function clearRecentVaults(): Promise<void> {
  await save([])
}
