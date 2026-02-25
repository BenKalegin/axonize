import { describe, it, expect } from 'vitest'
import { hashContent, createFileHash } from '@core/integrity/file-hasher'

describe('File Hasher', () => {
  it('should hash content deterministically', () => {
    const hash1 = hashContent('hello world')
    const hash2 = hashContent('hello world')
    expect(hash1).toBe(hash2)
  })

  it('should produce different hashes for different content', () => {
    const hash1 = hashContent('hello')
    const hash2 = hashContent('world')
    expect(hash1).not.toBe(hash2)
  })

  it('should produce a hex string', () => {
    const hash = hashContent('test')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should create file hash with metadata', () => {
    const fileHash = createFileHash('test.md', 'content', 12345)
    expect(fileHash.path).toBe('test.md')
    expect(fileHash.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(fileHash.modifiedAt).toBe(12345)
  })
})
