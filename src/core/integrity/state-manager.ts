import type { FileHash } from './file-hasher'
import type { SemanticGraph } from '../graph/types'

export interface VaultState {
  version: string
  vaultPath: string
  generatedAt: string
  files: FileHash[]
}

export function createVaultState(vaultPath: string, files: FileHash[]): VaultState {
  return {
    version: '0.1.0',
    vaultPath,
    generatedAt: new Date().toISOString(),
    files
  }
}

export function serializeState(state: VaultState): string {
  return JSON.stringify(state, null, 2)
}

export function deserializeState(json: string): VaultState {
  return JSON.parse(json) as VaultState
}

export interface SemanticSidecar {
  state: VaultState
  graph: SemanticGraph
}

export function findChangedFiles(
  oldState: VaultState,
  newFiles: FileHash[]
): { added: FileHash[]; modified: FileHash[]; removed: FileHash[] } {
  const oldMap = new Map(oldState.files.map(f => [f.path, f]))
  const newMap = new Map(newFiles.map(f => [f.path, f]))

  const added: FileHash[] = []
  const modified: FileHash[] = []
  const removed: FileHash[] = []

  for (const [path, newFile] of newMap) {
    const oldFile = oldMap.get(path)
    if (!oldFile) {
      added.push(newFile)
    } else if (oldFile.hash !== newFile.hash) {
      modified.push(newFile)
    }
  }

  for (const [path, oldFile] of oldMap) {
    if (!newMap.has(path)) {
      removed.push(oldFile)
    }
  }

  return { added, modified, removed }
}
