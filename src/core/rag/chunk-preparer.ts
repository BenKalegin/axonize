import type { Block } from '../markdown/types'
import type { EmbeddingChunk } from './types'

const MIN_CONTENT_LENGTH = 20
const SKIP_TYPES = new Set(['document'])

export function blocksToChunks(blocks: Block[]): EmbeddingChunk[] {
  const chunks: EmbeddingChunk[] = []

  for (const block of blocks) {
    if (SKIP_TYPES.has(block.type)) {
      continue
    }

    if (block.content.trim().length < MIN_CONTENT_LENGTH) {
      continue
    }

    const headingContext =
      block.headingPath.length > 0 ? block.headingPath.join(' > ') + '\n\n' : ''

    chunks.push({
      id: block.id,
      filePath: block.filePath,
      headingPath: [...block.headingPath],
      blockType: block.type,
      startLine: block.startLine,
      endLine: block.endLine,
      content: headingContext + block.content
    })
  }

  return chunks
}
