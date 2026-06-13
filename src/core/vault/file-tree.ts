import type { FileEntry } from './types'
import { dataFileKindOf } from './data-file-types'

export function flattenFileTree(entries: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = []
  for (const entry of entries) {
    result.push(entry)
    if (entry.isDirectory && entry.children) {
      result.push(...flattenFileTree(entry.children))
    }
  }
  return result
}

export function getMarkdownFiles(entries: FileEntry[]): FileEntry[] {
  return flattenFileTree(entries).filter(e => !e.isDirectory && e.name.endsWith('.md'))
}

export function getDataFiles(entries: FileEntry[]): FileEntry[] {
  return flattenFileTree(entries).filter(e => !e.isDirectory && dataFileKindOf(e.name) !== null)
}

export function findEntry(entries: FileEntry[], relativePath: string): FileEntry | undefined {
  for (const entry of entries) {
    if (entry.relativePath === relativePath) return entry
    if (entry.children) {
      const found = findEntry(entry.children, relativePath)
      if (found) return found
    }
  }
  return undefined
}
