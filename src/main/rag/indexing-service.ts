import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { parseMarkdown } from '../../core/markdown/parser'
import { extractBlocks } from '../../core/markdown/block-extractor'
import { hashContent } from '../../core/integrity/file-hasher'
import { readVaultFiles } from '../file-service'
import { getDataFiles, getMarkdownFiles } from '../../core/vault/file-tree'
import { dataFileKindOf } from '../../core/vault/data-file-types'
import { blocksToChunks } from '../../core/rag/chunk-preparer'
import {
  buildDataSchemaCard,
  dataSchemaBlockId,
  DATA_SCHEMA_BLOCK_TYPE
} from '../../core/rag/data-schema-card'
import { DataShape } from '../../core/data/types'
import { openDataFile, getRows } from '../data/data-file-service'
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
import log from '../logger'

// Bump to force a full rebuild when the chunk format changes.
// v2: synthetic data-file schema cards (.csv/.json/.jsonl) added to the index.
const RAG_INDEX_VERSION = 2
// Records embedded into a data-file schema card (never the raw file).
const DATA_SAMPLE_RECORDS = 2
const CONTENT_PREVIEW_CHARS = 200

type EmbeddingProvider = Awaited<ReturnType<typeof getEmbeddingProvider>>

interface EmbeddedChunks {
  meta: ChunkMeta[]
  rows: Float32Array[]
}

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

/** Cheap change signature for data files — content is never read just to hash. */
async function dataFileHash(fullPath: string): Promise<string> {
  const s = await stat(fullPath)
  return `${s.size}:${s.mtimeMs}`
}

async function embedMarkdownFile(
  provider: EmbeddingProvider,
  relativePath: string,
  content: string
): Promise<EmbeddedChunks> {
  const ast = parseMarkdown(content)
  const blocks = extractBlocks(ast, relativePath)
  const chunks = blocksToChunks(blocks)
  const meta: ChunkMeta[] = []
  const rows: Float32Array[] = []
  for (const chunk of chunks) {
    rows.push(await provider.embed(chunk.content))
    meta.push({
      blockId: chunk.id,
      filePath: chunk.filePath,
      headingPath: chunk.headingPath,
      blockType: chunk.blockType,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      contentPreview: chunk.content.slice(0, CONTENT_PREVIEW_CHARS)
    })
  }
  return { meta, rows }
}

async function embedDataFileCard(
  provider: EmbeddingProvider,
  vaultPath: string,
  relativePath: string
): Promise<EmbeddedChunks> {
  const fullPath = join(vaultPath, relativePath)
  try {
    const info = await openDataFile(fullPath)
    const samples =
      info.shape === DataShape.Table
        ? (await getRows(fullPath, 0, DATA_SAMPLE_RECORDS))
            .filter((r) => r.error === null)
            .map((r) => r.record)
        : []
    const card = buildDataSchemaCard(relativePath, info, samples)
    const vector = await provider.embed(card)
    return {
      meta: [
        {
          blockId: dataSchemaBlockId(relativePath),
          filePath: relativePath,
          headingPath: [],
          blockType: DATA_SCHEMA_BLOCK_TYPE,
          startLine: 0,
          endLine: 0,
          contentPreview: card.slice(0, CONTENT_PREVIEW_CHARS)
        }
      ],
      rows: [vector]
    }
  } catch (e) {
    log.error(`rag: skipping data file "${relativePath}":`, e)
    return { meta: [], rows: [] }
  }
}

async function embedVaultFile(
  provider: EmbeddingProvider,
  vaultPath: string,
  relativePath: string
): Promise<EmbeddedChunks> {
  if (dataFileKindOf(relativePath)) {
    return embedDataFileCard(provider, vaultPath, relativePath)
  }
  const content = await readFile(join(vaultPath, relativePath), 'utf-8')
  return embedMarkdownFile(provider, relativePath, content)
}

function concatVectors(dims: number, groups: Float32Array[][]): Float32Array {
  const total = groups.reduce((n, g) => n + g.length, 0)
  const out = new Float32Array(total * dims)
  let offset = 0
  for (const group of groups) {
    for (const row of group) {
      out.set(row, offset)
      offset += dims
    }
  }
  return out
}

async function indexableFiles(
  vaultPath: string
): Promise<{ mdFiles: { path: string; relativePath: string }[]; dataFiles: { path: string; relativePath: string }[] }> {
  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []
  const fileTree = await readVaultFiles(vaultPath)
  const notExcluded = (f: { relativePath: string }): boolean => !isExcluded(f.relativePath, excluded)
  return {
    mdFiles: getMarkdownFiles(fileTree).filter(notExcluded),
    dataFiles: getDataFiles(fileTree).filter(notExcluded)
  }
}

export async function incrementalReindex(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ chunkCount: number }> {
  const provider = await getEmbeddingProvider()
  const state = await loadIndexState(vaultPath)

  if (
    state &&
    (state.version !== RAG_INDEX_VERSION ||
      state.modelId !== provider.modelId ||
      state.dimensions !== provider.dimension)
  ) {
    return fullReindex(vaultPath, window)
  }

  sendProgress(window, { phase: 'scanning', current: 0, total: 0 })

  const { mdFiles, dataFiles } = await indexableFiles(vaultPath)
  const currentHashes: Record<string, string> = {}
  const changedFiles: string[] = []
  const removedFiles = new Set<string>(Object.keys(state?.fileHashes ?? {}))

  for (const file of mdFiles) {
    const content = await readFile(file.path, 'utf-8')
    const hash = hashContent(content)
    currentHashes[file.relativePath] = hash
    removedFiles.delete(file.relativePath)
    if (state?.fileHashes[file.relativePath] !== hash) {
      changedFiles.push(file.relativePath)
    }
  }
  for (const file of dataFiles) {
    const hash = await dataFileHash(file.path)
    currentHashes[file.relativePath] = hash
    removedFiles.delete(file.relativePath)
    if (state?.fileHashes[file.relativePath] !== hash) {
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
    sendProgress(window, { phase: 'extracting', current: idx + 1, total: changedFiles.length, file: relPath })
    sendProgress(window, { phase: 'embedding', current: idx + 1, total: changedFiles.length, file: relPath })

    const embedded = await embedVaultFile(provider, vaultPath, relPath)
    newMeta.push(...embedded.meta)
    newVectorRows.push(...embedded.rows)
  }

  const finalMeta = [...keptMeta, ...newMeta]
  const finalVectors = concatVectors(dims, [keptVectorRows, newVectorRows])

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })

  const newState: RagIndexState = {
    version: RAG_INDEX_VERSION,
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

  const { mdFiles, dataFiles } = await indexableFiles(vaultPath)
  const allFiles = [...mdFiles, ...dataFiles]
  const fileHashes: Record<string, string> = {}
  const allMeta: ChunkMeta[] = []
  const allVectorRows: Float32Array[] = []

  for (let idx = 0; idx < allFiles.length; idx++) {
    const file = allFiles[idx]
    sendProgress(window, { phase: 'extracting', current: idx + 1, total: allFiles.length, file: file.relativePath })

    fileHashes[file.relativePath] = dataFileKindOf(file.relativePath)
      ? await dataFileHash(file.path)
      : hashContent(await readFile(file.path, 'utf-8'))

    sendProgress(window, { phase: 'embedding', current: idx + 1, total: allFiles.length, file: file.relativePath })

    const embedded = await embedVaultFile(provider, vaultPath, file.relativePath)
    allMeta.push(...embedded.meta)
    allVectorRows.push(...embedded.rows)
  }

  const dims = provider.dimension
  const finalVectors = concatVectors(dims, [allVectorRows])

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })

  const state: RagIndexState = {
    version: RAG_INDEX_VERSION,
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

export async function purgeFolder(
  vaultPath: string,
  folderPath: string
): Promise<{ chunkCount: number }> {
  const state = await loadIndexState(vaultPath)
  if (!state || state.chunkCount === 0) {
    return { chunkCount: 0 }
  }

  const existingMetadata = await loadMetadata(vaultPath)
  const existingVectors = await loadVectors(vaultPath)
  const dims = state.dimensions

  const keptMeta: ChunkMeta[] = []
  const keptVectorRows: Float32Array[] = []

  for (let i = 0; i < existingMetadata.length; i++) {
    if (!isExcluded(existingMetadata[i].filePath, [folderPath])) {
      keptMeta.push(existingMetadata[i])
      keptVectorRows.push(existingVectors.subarray(i * dims, (i + 1) * dims))
    }
  }

  const finalVectors = concatVectors(dims, [keptVectorRows])

  const fileHashes = { ...state.fileHashes }
  for (const key of Object.keys(fileHashes)) {
    if (isExcluded(key, [folderPath])) {
      delete fileHashes[key]
    }
  }

  const newState: RagIndexState = {
    version: state.version,
    modelId: state.modelId,
    dimensions: dims,
    chunkCount: keptMeta.length,
    fileHashes
  }

  await saveIndexState(vaultPath, newState)
  await saveMetadata(vaultPath, keptMeta)
  await saveVectors(vaultPath, finalVectors)

  return { chunkCount: keptMeta.length }
}

export async function reindexFile(
  vaultPath: string,
  filePath: string,
  window: BrowserWindow | null
): Promise<{ chunkCount: number }> {
  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []
  if (isExcluded(filePath, excluded)) {
    throw new Error(`File "${filePath}" is in an excluded folder.`)
  }

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
  const fileHash = dataFileKindOf(filePath)
    ? await dataFileHash(fullPath)
    : hashContent(await readFile(fullPath, 'utf-8'))

  sendProgress(window, { phase: 'extracting', current: 1, total: 1, file: filePath })
  sendProgress(window, { phase: 'embedding', current: 1, total: 1, file: filePath })

  const embedded = await embedVaultFile(provider, vaultPath, filePath)

  const finalMeta = [...keptMeta, ...embedded.meta]
  const finalVectors = concatVectors(dims, [keptVectorRows, embedded.rows])

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })

  const fileHashes = { ...(state?.fileHashes ?? {}) }
  fileHashes[filePath] = fileHash

  const newState: RagIndexState = {
    version: RAG_INDEX_VERSION,
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
