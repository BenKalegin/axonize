import { readdir } from 'fs/promises'
import { join, relative } from 'path'

export interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileEntry[]
}

export async function readVaultFiles(vaultPath: string): Promise<FileEntry[]> {
  return scanDirectory(vaultPath, vaultPath)
}

async function scanDirectory(dirPath: string, rootPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const result: FileEntry[] = []

  const sorted = entries
    .filter(e => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  for (const entry of sorted) {
    const fullPath = join(dirPath, entry.name)
    const relPath = relative(rootPath, fullPath)

    if (entry.isDirectory()) {
      const children = await scanDirectory(fullPath, rootPath)
      result.push({
        name: entry.name,
        path: fullPath,
        relativePath: relPath,
        isDirectory: true,
        children
      })
    } else if (entry.name.endsWith('.md')) {
      result.push({
        name: entry.name,
        path: fullPath,
        relativePath: relPath,
        isDirectory: false
      })
    }
  }

  return result
}
