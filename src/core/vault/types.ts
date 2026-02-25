export interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileEntry[]
}

export interface VaultInfo {
  path: string
  name: string
  fileCount: number
}
