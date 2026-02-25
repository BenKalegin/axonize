import { createHash } from 'crypto'

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export interface FileHash {
  path: string
  hash: string
  modifiedAt: number
}

export function createFileHash(path: string, content: string, modifiedAt: number): FileHash {
  return {
    path,
    hash: hashContent(content),
    modifiedAt
  }
}
