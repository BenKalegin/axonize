export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) {
    return 0
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) {
    return 0
  }

  return dot / denominator
}

export function topKSimilar(
  queryVector: Float32Array,
  vectors: Float32Array,
  dims: number,
  k: number
): Array<{ index: number; score: number }> {
  const count = vectors.length / dims
  const scores: Array<{ index: number; score: number }> = []

  for (let i = 0; i < count; i++) {
    const offset = i * dims
    const chunk = vectors.subarray(offset, offset + dims) as Float32Array
    const score = cosineSimilarity(queryVector, chunk)
    scores.push({ index: i, score })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, k)
}
