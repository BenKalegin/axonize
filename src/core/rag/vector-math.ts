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

const KMEANS_MAX_ITERATIONS = 50
const KMEANS_CONVERGENCE_THRESHOLD = 1e-6

export function kMeansClusters(
  vectors: Float32Array,
  dims: number,
  k: number
): number[][] {
  const count = vectors.length / dims
  if (count <= k) {
    return Array.from({ length: count }, (_, i) => [i])
  }

  // Initialize centroids with k-means++ seeding
  const centroids = kMeansPlusPlusInit(vectors, dims, k, count)
  const assignments = new Int32Array(count)

  for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
    // Assign each vector to the nearest centroid
    for (let i = 0; i < count; i++) {
      const vec = vectors.subarray(i * dims, (i + 1) * dims)
      let bestDist = -Infinity
      let bestK = 0
      for (let j = 0; j < k; j++) {
        const sim = cosineSimilarity(vec as Float32Array, centroids[j])
        if (sim > bestDist) {
          bestDist = sim
          bestK = j
        }
      }
      assignments[i] = bestK
    }

    // Recompute centroids
    let maxShift = 0
    for (let j = 0; j < k; j++) {
      const newCentroid = new Float32Array(dims)
      let memberCount = 0
      for (let i = 0; i < count; i++) {
        if (assignments[i] !== j) continue
        memberCount++
        const vec = vectors.subarray(i * dims, (i + 1) * dims)
        for (let d = 0; d < dims; d++) newCentroid[d] += vec[d]
      }
      if (memberCount > 0) {
        for (let d = 0; d < dims; d++) newCentroid[d] /= memberCount
      }
      const shift = 1 - cosineSimilarity(centroids[j], newCentroid)
      if (shift > maxShift) maxShift = shift
      centroids[j] = newCentroid
    }

    if (maxShift < KMEANS_CONVERGENCE_THRESHOLD) break
  }

  // Collect groups
  const groups: number[][] = Array.from({ length: k }, () => [])
  for (let i = 0; i < count; i++) {
    groups[assignments[i]].push(i)
  }
  return groups.filter((g) => g.length > 0)
}

function kMeansPlusPlusInit(
  vectors: Float32Array,
  dims: number,
  k: number,
  count: number
): Float32Array[] {
  const centroids: Float32Array[] = []
  const firstIdx = Math.floor(Math.random() * count)
  centroids.push(new Float32Array(vectors.subarray(firstIdx * dims, (firstIdx + 1) * dims)))

  const distances = new Float64Array(count).fill(Infinity)

  for (let c = 1; c < k; c++) {
    const latest = centroids[c - 1]
    for (let i = 0; i < count; i++) {
      const vec = vectors.subarray(i * dims, (i + 1) * dims) as Float32Array
      const dist = 1 - cosineSimilarity(vec, latest)
      if (dist < distances[i]) distances[i] = dist
    }
    let totalDist = 0
    for (let i = 0; i < count; i++) totalDist += distances[i]

    let threshold = Math.random() * totalDist
    let chosen = 0
    for (let i = 0; i < count; i++) {
      threshold -= distances[i]
      if (threshold <= 0) {
        chosen = i
        break
      }
    }
    centroids.push(new Float32Array(vectors.subarray(chosen * dims, (chosen + 1) * dims)))
  }

  return centroids
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
