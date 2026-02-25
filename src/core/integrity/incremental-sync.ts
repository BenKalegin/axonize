import type { ParsedDocument } from '../markdown/types'
import type { SemanticGraph } from '../graph/types'
import type { VaultState } from './state-manager'
import type { FileHash } from './file-hasher'
import { createFileHash } from './file-hasher'
import { createVaultState, findChangedFiles } from './state-manager'
import { parseMarkdown } from '../markdown/parser'
import { extractBlocks } from '../markdown/block-extractor'
import { buildGraph } from '../graph/graph-builder'

export interface SyncResult {
  state: VaultState
  graph: SemanticGraph
  documents: ParsedDocument[]
  changedFiles: number
}

export function fullSync(
  vaultPath: string,
  files: Array<{ relativePath: string; content: string; modifiedAt: number }>
): SyncResult {
  const fileHashes: FileHash[] = files.map(f =>
    createFileHash(f.relativePath, f.content, f.modifiedAt)
  )

  const documents: ParsedDocument[] = files.map(f => {
    const ast = parseMarkdown(f.content)
    const blocks = extractBlocks(ast, f.relativePath)
    return { filePath: f.relativePath, blocks }
  })

  const graph = buildGraph(documents)
  const state = createVaultState(vaultPath, fileHashes)

  return { state, graph, documents, changedFiles: files.length }
}

export function incrementalSync(
  vaultPath: string,
  previousState: VaultState,
  allFiles: Array<{ relativePath: string; content: string; modifiedAt: number }>
): SyncResult {
  const newHashes: FileHash[] = allFiles.map(f =>
    createFileHash(f.relativePath, f.content, f.modifiedAt)
  )

  const changes = findChangedFiles(previousState, newHashes)
  const changedPaths = new Set([
    ...changes.added.map(f => f.path),
    ...changes.modified.map(f => f.path),
    ...changes.removed.map(f => f.path)
  ])

  // For simplicity in v0.1, rebuild everything if there are changes
  // Future: only rebuild affected documents
  if (changedPaths.size === 0) {
    // No changes — reparse and rebuild (idempotent)
    const documents: ParsedDocument[] = allFiles.map(f => {
      const ast = parseMarkdown(f.content)
      const blocks = extractBlocks(ast, f.relativePath)
      return { filePath: f.relativePath, blocks }
    })
    const graph = buildGraph(documents)
    return {
      state: createVaultState(vaultPath, newHashes),
      graph,
      documents,
      changedFiles: 0
    }
  }

  // Full rebuild for changed vaults
  return fullSync(vaultPath, allFiles)
}
