import { readFile, writeFile, mkdir, rename } from 'fs/promises'
import { join } from 'path'
import type { ChunkMeta, RagIndexState } from '../../core/rag/types'

export function ragDir(vaultPath: string): string {
  return join(vaultPath, '.axonize', 'rag')
}

export async function ensureRagDir(vaultPath: string): Promise<string> {
  const dir = ragDir(vaultPath)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function loadIndexState(vaultPath: string): Promise<RagIndexState | null> {
  try {
    const raw = await readFile(join(ragDir(vaultPath), 'index-state.json'), 'utf-8')
    return JSON.parse(raw) as RagIndexState
  } catch {
    return null
  }
}

export async function saveIndexState(vaultPath: string, state: RagIndexState): Promise<void> {
  const dir = await ensureRagDir(vaultPath)
  const filePath = join(dir, 'index-state.json')
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(state, null, 2) + '\n', 'utf-8')
  await rename(tempPath, filePath)
}

export async function loadMetadata(vaultPath: string): Promise<ChunkMeta[]> {
  try {
    const raw = await readFile(join(ragDir(vaultPath), 'metadata.json'), 'utf-8')
    return JSON.parse(raw) as ChunkMeta[]
  } catch {
    return []
  }
}

export async function saveMetadata(vaultPath: string, metadata: ChunkMeta[]): Promise<void> {
  const dir = await ensureRagDir(vaultPath)
  const filePath = join(dir, 'metadata.json')
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(metadata, null, 2) + '\n', 'utf-8')
  await rename(tempPath, filePath)
}

export async function loadVectors(vaultPath: string): Promise<Float32Array> {
  try {
    const buffer = await readFile(join(ragDir(vaultPath), 'vectors.bin'))
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
  } catch {
    return new Float32Array(0)
  }
}

export async function saveVectors(vaultPath: string, vectors: Float32Array): Promise<void> {
  const dir = await ensureRagDir(vaultPath)
  const filePath = join(dir, 'vectors.bin')
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength))
  await rename(tempPath, filePath)
}
