import { readFile } from 'fs/promises'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { parseMarkdown } from '../../core/markdown/parser'
import { extractBlocks } from '../../core/markdown/block-extractor'
import { hashContent } from '../../core/integrity/file-hasher'
import { readVaultFiles } from '../file-service'
import { getMarkdownFiles } from '../../core/vault/file-tree'
import { blocksToChunks } from '../../core/rag/chunk-preparer'
import { getEmbeddingProvider } from './provider-factory'
import {
  loadIndexState,
  loadMetadata,
  loadVectors,
  saveIndexState,
  saveMetadata,
  saveVectors
} from './embedding-store'
import type { ChunkMeta, IndexProgress, RagIndexState } from '../../core/rag/types'
import { getSettings } from '../settings-service'

function isExcluded(relativePath: string, excludedFolders: string[]): boolean {
  return excludedFolders.some(
    (folder) => relativePath === folder || relativePath.startsWith(folder + '/')
  )
}

function sendProgress(window: BrowserWindow | null, progress: IndexProgress): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send('rag:indexProgress', progress)
  }
}

export async function incrementalReindex(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ chunkCount: number }> {
  const provider = await getEmbeddingProvider()
  const state = await loadIndexState(vaultPath)

  if (state && (state.modelId !== provider.modelId || state.dimensions !== provider.dimension)) {
    return fullReindex(vaultPath, window)
  }

  sendProgress(window, { phase: 'scanning', current: 0, total: 0 })

  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []

  const fileTree = await readVaultFiles(vaultPath)
  const mdFiles = getMarkdownFiles(fileTree).filter(
    (f) => !isExcluded(f.relativePath, excluded)
  )
  const currentHashes: Record<string, string> = {}
  const changedFiles: string[] = []
  const removedFiles = new Set<string>(Object.keys(state?.fileHashes ?? {}))

  for (const file of mdFiles) {
    const content = await readFile(file.path, 'utf-8')
    const hash = hashContent(content)
    currentHashes[file.relativePath] = hash
    removedFiles.delete(file.relativePath)

    if (!state?.fileHashes[file.relativePath] || state.fileHashes[file.relativePath] !== hash) {
      changedFiles.push(file.relativePath)
    }
  }

  if (changedFiles.length === 0 && removedFiles.size === 0 && state) {
    sendProgress(window, { phase: 'done', current: state.chunkCount, total: state.chunkCount })
    return { chunkCount: state.chunkCount }
  }

  const existingMetadata = await loadMetadata(vaultPath)
  const existingVectors = await loadVectors(vaultPath)
  const dims = provider.dimension

  const changedSet = new Set([...changedFiles, ...removedFiles])
  const keptMeta: ChunkMeta[] = []
  const keptVectorRows: Float32Array[] = []

  for (let i = 0; i < existingMetadata.length; i++) {
    if (!changedSet.has(existingMetadata[i].filePath)) {
      keptMeta.push(existingMetadata[i])
      keptVectorRows.push(existingVectors.subarray(i * dims, (i + 1) * dims))
    }
  }

  sendProgress(window, { phase: 'extracting', current: 0, total: changedFiles.length })

  const newMeta: ChunkMeta[] = []
  const newVectorRows: Float32Array[] = []

  for (let idx = 0; idx < changedFiles.length; idx++) {
    const relPath = changedFiles[idx]
    const fullPath = join(vaultPath, relPath)
    sendProgress(window, { phase: 'extracting', current: idx + 1, total: changedFiles.length, file: relPath })

    const content = await readFile(fullPath, 'utf-8')
    const ast = parseMarkdown(content)
    const blocks = extractBlocks(ast, relPath)
    const chunks = blocksToChunks(blocks)

    sendProgress(window, { phase: 'embedding', current: idx + 1, total: changedFiles.length, file: relPath })

    for (const chunk of chunks) {
      const vector = await provider.embed(chunk.content)
      newMeta.push({
        blockId: chunk.id,
        filePath: chunk.filePath,
        headingPath: chunk.headingPath,
        blockType: chunk.blockType,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        contentPreview: chunk.content.slice(0, 200)
      })
      newVectorRows.push(vector)
    }
  }

  const finalMeta = [...keptMeta, ...newMeta]
  const finalVectors = new Float32Array(finalMeta.length * dims)
  let offset = 0

  for (const row of keptVectorRows) {
    finalVectors.set(row, offset)
    offset += dims
  }
  for (const row of newVectorRows) {
    finalVectors.set(row, offset)
    offset += dims
  }

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })

  const newState: RagIndexState = {
    version: 1,
    modelId: provider.modelId,
    dimensions: dims,
    chunkCount: finalMeta.length,
    fileHashes: currentHashes
  }

  await saveIndexState(vaultPath, newState)
  await saveMetadata(vaultPath, finalMeta)
  await saveVectors(vaultPath, finalVectors)

  sendProgress(window, { phase: 'done', current: finalMeta.length, total: finalMeta.length })
  return { chunkCount: finalMeta.length }
}

export async function fullReindex(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ chunkCount: number }> {
  const provider = await getEmbeddingProvider()

  sendProgress(window, { phase: 'scanning', current: 0, total: 0 })

  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []

  const fileTree = await readVaultFiles(vaultPath)
  const mdFiles = getMarkdownFiles(fileTree).filter(
    (f) => !isExcluded(f.relativePath, excluded)
  )
  const fileHashes: Record<string, string> = {}
  const allMeta: ChunkMeta[] = []
  const allVectorRows: Float32Array[] = []

  for (let idx = 0; idx < mdFiles.length; idx++) {
    const file = mdFiles[idx]
    sendProgress(window, { phase: 'extracting', current: idx + 1, total: mdFiles.length, file: file.relativePath })

    const content = await readFile(file.path, 'utf-8')
    fileHashes[file.relativePath] = hashContent(content)

    const ast = parseMarkdown(content)
    const blocks = extractBlocks(ast, file.relativePath)
    const chunks = blocksToChunks(blocks)

    sendProgress(window, { phase: 'embedding', current: idx + 1, total: mdFiles.length, file: file.relativePath })

    for (const chunk of chunks) {
      const vector = await provider.embed(chunk.content)
      allMeta.push({
        blockId: chunk.id,
        filePath: chunk.filePath,
        headingPath: chunk.headingPath,
        blockType: chunk.blockType,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        contentPreview: chunk.content.slice(0, 200)
      })
      allVectorRows.push(vector)
    }
  }

  const dims = provider.dimension
  const finalVectors = new Float32Array(allMeta.length * dims)
  let offset = 0
  for (const row of allVectorRows) {
    finalVectors.set(row, offset)
    offset += dims
  }

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })

  const state: RagIndexState = {
    version: 1,
    modelId: provider.modelId,
    dimensions: dims,
    chunkCount: allMeta.length,
    fileHashes
  }

  await saveIndexState(vaultPath, state)
  await saveMetadata(vaultPath, allMeta)
  await saveVectors(vaultPath, finalVectors)

  sendProgress(window, { phase: 'done', current: allMeta.length, total: allMeta.length })
  return { chunkCount: allMeta.length }
}

export async function reindexFile(
  vaultPath: string,
  filePath: string,
  window: BrowserWindow | null
): Promise<{ chunkCount: number }> {
  const provider = await getEmbeddingProvider()
  const state = await loadIndexState(vaultPath)
  const existingMetadata = await loadMetadata(vaultPath)
  const existingVectors = await loadVectors(vaultPath)
  const dims = provider.dimension

  const keptMeta: ChunkMeta[] = []
  const keptVectorRows: Float32Array[] = []

  for (let i = 0; i < existingMetadata.length; i++) {
    if (existingMetadata[i].filePath !== filePath) {
      keptMeta.push(existingMetadata[i])
      keptVectorRows.push(existingVectors.subarray(i * dims, (i + 1) * dims))
    }
  }

  const fullPath = join(vaultPath, filePath)
  const content = await readFile(fullPath, 'utf-8')
  const fileHash = hashContent(content)

  sendProgress(window, { phase: 'extracting', current: 1, total: 1, file: filePath })

  const ast = parseMarkdown(content)
  const blocks = extractBlocks(ast, filePath)
  const chunks = blocksToChunks(blocks)

  sendProgress(window, { phase: 'embedding', current: 1, total: 1, file: filePath })

  const newMeta: ChunkMeta[] = []
  const newVectorRows: Float32Array[] = []

  for (const chunk of chunks) {
    const vector = await provider.embed(chunk.content)
    newMeta.push({
      blockId: chunk.id,
      filePath: chunk.filePath,
      headingPath: chunk.headingPath,
      blockType: chunk.blockType,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      contentPreview: chunk.content.slice(0, 200)
    })
    newVectorRows.push(vector)
  }

  const finalMeta = [...keptMeta, ...newMeta]
  const finalVectors = new Float32Array(finalMeta.length * dims)
  let offset = 0
  for (const row of keptVectorRows) {
    finalVectors.set(row, offset)
    offset += dims
  }
  for (const row of newVectorRows) {
    finalVectors.set(row, offset)
    offset += dims
  }

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })

  const fileHashes = { ...(state?.fileHashes ?? {}) }
  fileHashes[filePath] = fileHash

  const newState: RagIndexState = {
    version: 1,
    modelId: provider.modelId,
    dimensions: dims,
    chunkCount: finalMeta.length,
    fileHashes
  }

  await saveIndexState(vaultPath, newState)
  await saveMetadata(vaultPath, finalMeta)
  await saveVectors(vaultPath, finalVectors)

  sendProgress(window, { phase: 'done', current: finalMeta.length, total: finalMeta.length })
  return { chunkCount: finalMeta.length }
}
