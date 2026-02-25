import { EmbeddingProvider } from '../../core/rag/embedding-provider'

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'
const DIMENSIONS = 384

export class LocalMiniLMProvider extends EmbeddingProvider {
  readonly modelId = 'local-minilm'
  readonly dimension = DIMENSIONS

  private pipeline: unknown = null

  async initialize(): Promise<void> {
    if (this.pipeline) {
      return
    }
    const { pipeline } = await import('@xenova/transformers')
    this.pipeline = await pipeline('feature-extraction', MODEL_NAME)
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.pipeline) {
      await this.initialize()
    }

    const pipe = this.pipeline as (
      input: string,
      options: { pooling: string; normalize: boolean }
    ) => Promise<{ data: Float32Array }>

    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return new Float32Array(output.data)
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = []
    for (const text of texts) {
      results.push(await this.embed(text))
    }
    return results
  }

  async dispose(): Promise<void> {
    this.pipeline = null
  }
}
