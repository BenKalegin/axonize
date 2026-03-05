import { readFile, writeFile, rename, mkdir } from 'fs/promises'
import { join } from 'path'
import type { SemanticCard } from '../../core/semantic/types'
import { getEmbeddingProvider } from '../rag/provider-factory'
import log from '../logger'

const VECTORS_FILE = 'summary-vectors.bin'
const CARD_IDS_FILE = 'summary-card-ids.json'

function semanticDir(vaultPath: string): string {
  return join(vaultPath, '.axonize', 'semantic')
}

async function atomicWriteBuffer(filePath: string, buffer: Buffer): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, buffer)
  await rename(tempPath, filePath)
}

async function atomicWriteJSON(filePath: string, data: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  await rename(tempPath, filePath)
}

export async function embedAndCacheSummaries(
  vaultPath: string,
  cards: SemanticCard[]
): Promise<void> {
  const provider = await getEmbeddingProvider()
  const summaries = cards.map((c) => c.summary)
  const cardIds = cards.map((c) => c.id)

  log.info(`[semantic] Embedding ${summaries.length} card summaries`)
  const vectors = await provider.embedBatch(summaries)

  const dims = vectors.length > 0 ? vectors[0].length : 0
  const concatenated = new Float32Array(vectors.length * dims)
  for (let i = 0; i < vectors.length; i++) {
    concatenated.set(vectors[i], i * dims)
  }

  const dir = semanticDir(vaultPath)
  await mkdir(dir, { recursive: true })
  await atomicWriteBuffer(join(dir, VECTORS_FILE), Buffer.from(concatenated.buffer))
  await atomicWriteJSON(join(dir, CARD_IDS_FILE), cardIds)
  log.info(`[semantic] Cached ${cardIds.length} summary vectors (${dims}d)`)
}

export async function loadSummaryVectors(
  vaultPath: string
): Promise<{ cardIds: string[]; vectors: Float32Array; dims: number } | null> {
  const dir = semanticDir(vaultPath)
  try {
    const [idsRaw, vecBuf] = await Promise.all([
      readFile(join(dir, CARD_IDS_FILE), 'utf-8'),
      readFile(join(dir, VECTORS_FILE))
    ])
    const cardIds = JSON.parse(idsRaw) as string[]
    const vectors = new Float32Array(vecBuf.buffer, vecBuf.byteOffset, vecBuf.byteLength / Float32Array.BYTES_PER_ELEMENT)
    const dims = cardIds.length > 0 ? vectors.length / cardIds.length : 0
    return { cardIds, vectors, dims }
  } catch {
    return null
  }
}
