import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readVaultFiles } from '../../../src/main/file-service'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'axonize-vault-'))
})

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true })
  }
})

describe('readVaultFiles', () => {
  it('returns markdown files from normal vault folders', async () => {
    await mkdir(join(root, 'doc'), { recursive: true })
    await writeFile(join(root, 'doc', 'diagram-gallery.md'), '# Diagram gallery\n')
    await writeFile(join(root, 'notes.txt'), 'not markdown\n')

    const files = await readVaultFiles(root)

    expect(files).toEqual([
      expect.objectContaining({
        name: 'doc',
        isDirectory: true,
        children: [
          expect.objectContaining({
            name: 'diagram-gallery.md',
            isDirectory: false
          })
        ]
      })
    ])
  })

  it('skips dependency, build, and internal folders when opening a repo root', async () => {
    await mkdir(join(root, 'doc'), { recursive: true })
    await mkdir(join(root, 'node_modules', 'package'), { recursive: true })
    await mkdir(join(root, '.axonize'), { recursive: true })
    await mkdir(join(root, 'out'), { recursive: true })
    await writeFile(join(root, 'doc', 'diagram-gallery.md'), '# Demo\n')
    await writeFile(join(root, 'node_modules', 'package', 'README.md'), '# Dependency\n')
    await writeFile(join(root, '.axonize', 'internal.md'), '# Internal\n')
    await writeFile(join(root, 'out', 'built.md'), '# Built\n')

    const files = await readVaultFiles(root)
    const names = files.map((entry) => entry.name)

    expect(names).toContain('doc')
    expect(names).not.toContain('node_modules')
    expect(names).not.toContain('.axonize')
    expect(names).not.toContain('out')
  })
})
