import { describe, it, expect } from 'vitest'
import { cosineSimilarity, topKSimilar } from '@core/rag/vector-math'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([-1, -2, -3])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('returns 0 for empty vectors', () => {
    const a = new Float32Array([])
    const b = new Float32Array([])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('returns 0 for zero vector', () => {
    const a = new Float32Array([0, 0, 0])
    const b = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('returns 0 for mismatched lengths', () => {
    const a = new Float32Array([1, 2])
    const b = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('handles non-unit vectors correctly', () => {
    const a = new Float32Array([3, 4])
    const b = new Float32Array([6, 8])
    // Same direction, different magnitudes → cosine = 1
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5)
  })
})

describe('topKSimilar', () => {
  it('returns top-K results sorted by score descending', () => {
    const dims = 3
    const query = new Float32Array([1, 0, 0])

    // 4 vectors: indices 0-3
    const vectors = new Float32Array([
      0, 1, 0, // index 0: orthogonal → score ~0
      1, 0, 0, // index 1: identical → score 1
      0.7, 0.7, 0, // index 2: similar → score ~0.707
      -1, 0, 0 // index 3: opposite → score -1
    ])

    const results = topKSimilar(query, vectors, dims, 2)
    expect(results).toHaveLength(2)
    expect(results[0].index).toBe(1)
    expect(results[0].score).toBeCloseTo(1, 3)
    expect(results[1].index).toBe(2)
    expect(results[1].score).toBeGreaterThan(0.5)
  })

  it('returns all results when k exceeds count', () => {
    const dims = 2
    const query = new Float32Array([1, 0])
    const vectors = new Float32Array([1, 0, 0, 1])

    const results = topKSimilar(query, vectors, dims, 10)
    expect(results).toHaveLength(2)
  })

  it('returns empty array for empty vectors', () => {
    const query = new Float32Array([1, 0])
    const vectors = new Float32Array([])
    const results = topKSimilar(query, vectors, 2, 5)
    expect(results).toHaveLength(0)
  })

  it('handles k=0', () => {
    const query = new Float32Array([1, 0])
    const vectors = new Float32Array([1, 0])
    const results = topKSimilar(query, vectors, 2, 0)
    expect(results).toHaveLength(0)
  })

  it('preserves correct index mapping with many vectors', () => {
    const dims = 2
    const query = new Float32Array([1, 0])
    // 5 vectors, the best match is at index 4
    const vectors = new Float32Array([
      0, 1, // 0: orthogonal
      0.5, 0.5, // 1: medium
      0.3, 0.9, // 2: low
      0.8, 0.2, // 3: high
      0.99, 0.1 // 4: highest
    ])

    const results = topKSimilar(query, vectors, dims, 3)
    expect(results[0].index).toBe(4)
    expect(results[1].index).toBe(3)
  })
})
