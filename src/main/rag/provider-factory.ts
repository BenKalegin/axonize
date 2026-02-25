import { EmbeddingProvider } from '../../core/rag/embedding-provider'
import { LocalMiniLMProvider } from './local-embedding-provider'
import { LLMProvider } from '../../core/rag/llm-provider'
import { createLLMProvider } from '../../core/rag/llm-factory'
import type { LLMConfig } from '../../core/rag/types'

let embeddingInstance: EmbeddingProvider | null = null

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (!embeddingInstance) {
    embeddingInstance = new LocalMiniLMProvider()
    await embeddingInstance.initialize()
  }
  return embeddingInstance
}

export function getLLMProvider(config: LLMConfig): LLMProvider {
  return createLLMProvider(config)
}

export async function disposeEmbeddingProvider(): Promise<void> {
  if (embeddingInstance) {
    await embeddingInstance.dispose()
    embeddingInstance = null
  }
}
