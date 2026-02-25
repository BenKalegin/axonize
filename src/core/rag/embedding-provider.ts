export abstract class EmbeddingProvider {
  abstract readonly modelId: string
  abstract readonly dimension: number

  abstract initialize(): Promise<void>
  abstract embed(text: string): Promise<Float32Array>
  abstract embedBatch(texts: string[]): Promise<Float32Array[]>
  abstract dispose(): Promise<void>
}
