import { readdir, stat } from 'fs/promises'
import { join, relative } from 'path'

const RECENTLY_MODIFIED_MAX = 10

const IGNORED_DIRS = new Set([
  '.axonize',
  '.cache',
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out'
])

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

export async function listAllFiles(vaultPath: string): Promise<string[]> {
  const result: string[] = []
  await collectAllFiles(vaultPath, vaultPath, result)
  return result
}

export interface ModifiedFile {
  path: string
  modifiedAt: number
}

export async function listRecentlyModifiedFiles(vaultPath: string): Promise<ModifiedFile[]> {
  const files: ModifiedFile[] = []
  await collectModifiedFiles(vaultPath, files)
  return files
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, RECENTLY_MODIFIED_MAX)
}

async function collectModifiedFiles(dirPath: string, out: ModifiedFile[]): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await collectModifiedFiles(fullPath, out)
    } else if (entry.name.endsWith('.md')) {
      const stats = await stat(fullPath)
      out.push({ path: fullPath, modifiedAt: stats.mtimeMs })
    }
  }
}

async function collectAllFiles(
  dirPath: string,
  rootPath: string,
  out: string[]
): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await collectAllFiles(fullPath, rootPath, out)
    } else {
      out.push(relative(rootPath, fullPath))
    }
  }
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
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue
    }

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
