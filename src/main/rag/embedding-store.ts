import { readFile, writeFile, mkdir, rename, unlink } from 'fs/promises'
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

/** Write-then-rename for atomicity; on rename failure, clean up and fall back to a direct write. */
async function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void> {
  const tempPath = `${filePath}.tmp`
  try {
    await writeFile(tempPath, data)
    await rename(tempPath, filePath)
  } catch {
    await unlink(tempPath).catch(() => {})
    await writeFile(filePath, data)
  }
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
  await writeFileAtomic(join(dir, 'index-state.json'), JSON.stringify(state, null, 2) + '\n')
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
  await writeFileAtomic(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n')
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
  await writeFileAtomic(
    join(dir, 'vectors.bin'),
    Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength)
  )
}
