import { describe, it, expect } from 'vitest'
import { createVaultState, findChangedFiles, serializeState, deserializeState } from '@core/integrity/state-manager'
import { createFileHash } from '@core/integrity/file-hasher'

describe('State Manager', () => {
  it('should create vault state', () => {
    const files = [createFileHash('a.md', 'content a', 1000)]
    const state = createVaultState('/vault', files)

    expect(state.version).toBe('0.1.0')
    expect(state.vaultPath).toBe('/vault')
    expect(state.files).toHaveLength(1)
    expect(state.generatedAt).toBeDefined()
  })

  it('should serialize and deserialize state', () => {
    const files = [createFileHash('a.md', 'content', 1000)]
    const state = createVaultState('/vault', files)
    const json = serializeState(state)
    const parsed = deserializeState(json)

    expect(parsed.version).toBe(state.version)
    expect(parsed.vaultPath).toBe(state.vaultPath)
    expect(parsed.files).toHaveLength(1)
    expect(parsed.files[0].hash).toBe(state.files[0].hash)
  })

  it('should detect added files', () => {
    const oldFiles = [createFileHash('a.md', 'content a', 1000)]
    const oldState = createVaultState('/vault', oldFiles)

    const newFiles = [
      createFileHash('a.md', 'content a', 1000),
      createFileHash('b.md', 'content b', 2000)
    ]

    const changes = findChangedFiles(oldState, newFiles)
    expect(changes.added).toHaveLength(1)
    expect(changes.added[0].path).toBe('b.md')
    expect(changes.modified).toHaveLength(0)
    expect(changes.removed).toHaveLength(0)
  })

  it('should detect modified files', () => {
    const oldFiles = [createFileHash('a.md', 'content a', 1000)]
    const oldState = createVaultState('/vault', oldFiles)

    const newFiles = [createFileHash('a.md', 'content a modified', 2000)]

    const changes = findChangedFiles(oldState, newFiles)
    expect(changes.added).toHaveLength(0)
    expect(changes.modified).toHaveLength(1)
    expect(changes.modified[0].path).toBe('a.md')
    expect(changes.removed).toHaveLength(0)
  })

  it('should detect removed files', () => {
    const oldFiles = [
      createFileHash('a.md', 'content a', 1000),
      createFileHash('b.md', 'content b', 1000)
    ]
    const oldState = createVaultState('/vault', oldFiles)

    const newFiles = [createFileHash('a.md', 'content a', 1000)]

    const changes = findChangedFiles(oldState, newFiles)
    expect(changes.added).toHaveLength(0)
    expect(changes.modified).toHaveLength(0)
    expect(changes.removed).toHaveLength(1)
    expect(changes.removed[0].path).toBe('b.md')
  })

  it('should detect no changes', () => {
    const files = [createFileHash('a.md', 'content a', 1000)]
    const oldState = createVaultState('/vault', files)

    const changes = findChangedFiles(oldState, files)
    expect(changes.added).toHaveLength(0)
    expect(changes.modified).toHaveLength(0)
    expect(changes.removed).toHaveLength(0)
  })
})
