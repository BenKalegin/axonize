import { describe, it, expect, vi, beforeEach } from 'vitest'

// Simulated filesystem: maps absolute paths to file contents. The real service
// uses write-then-rename for atomicity, so the mock has to model that pattern.
const fakeFs = new Map<string, string>()
let lastWrittenContent: string | null = null
const TARGET_PATH = '/tmp/test-userdata/recent-vaults.json'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-userdata'
  }
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    const content = fakeFs.get(path)
    if (content === undefined) throw new Error('ENOENT')
    return content
  }),
  writeFile: vi.fn(async (path: string, content: string) => {
    fakeFs.set(path, content)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const content = fakeFs.get(from)
    if (content === undefined) throw new Error('ENOENT')
    fakeFs.set(to, content)
    fakeFs.delete(from)
    if (to === TARGET_PATH) lastWrittenContent = content
  })
}))

import {
  getRecentVaults,
  addRecentVault,
  removeRecentVault,
  clearRecentVaults
} from '../../../src/main/recent-vaults-service'

beforeEach(() => {
  fakeFs.clear()
  lastWrittenContent = null
})

function seed(vaults: { path: string; name: string; openedAt: number }[]): void {
  fakeFs.set(TARGET_PATH, JSON.stringify(vaults))
}

describe('RecentVaultsService', () => {
  describe('getRecentVaults', () => {
    it('should return empty array when file does not exist', async () => {
      const result = await getRecentVaults()
      expect(result).toEqual([])
    })

    it('should return empty array when file contains invalid JSON', async () => {
      fakeFs.set(TARGET_PATH, 'not json')
      const result = await getRecentVaults()
      expect(result).toEqual([])
    })

    it('should return empty array when file contains non-array JSON', async () => {
      fakeFs.set(TARGET_PATH, '{"foo": "bar"}')
      const result = await getRecentVaults()
      expect(result).toEqual([])
    })

    it('should return vaults from valid JSON file', async () => {
      const vaults = [{ path: '/a', name: 'a', openedAt: 100 }]
      seed(vaults)
      const result = await getRecentVaults()
      expect(result).toEqual(vaults)
    })
  })

  describe('addRecentVault', () => {
    it('should add a new vault entry', async () => {
      await addRecentVault('/vault1', 'vault1')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/vault1')
      expect(result[0].name).toBe('vault1')
      expect(result[0].openedAt).toBeGreaterThan(0)
    })

    it('should deduplicate by path, updating timestamp', async () => {
      seed([{ path: '/vault1', name: 'vault1', openedAt: 100 }])
      await addRecentVault('/vault1', 'vault1')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
      expect(result[0].openedAt).toBeGreaterThan(100)
    })

    it('should place new vault at the beginning', async () => {
      seed([{ path: '/vault1', name: 'vault1', openedAt: 100 }])
      await addRecentVault('/vault2', 'vault2')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(2)
      expect(result[0].path).toBe('/vault2')
      expect(result[1].path).toBe('/vault1')
    })

    it('should cap at 10 entries', async () => {
      const existing = Array.from({ length: 10 }, (_, i) => ({
        path: `/vault${i}`,
        name: `vault${i}`,
        openedAt: i
      }))
      seed(existing)
      await addRecentVault('/vault-new', 'vault-new')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(10)
      expect(result[0].path).toBe('/vault-new')
      expect(result[9].path).toBe('/vault8')
    })

    it('should write atomically via .tmp + rename (no .tmp left behind)', async () => {
      await addRecentVault('/vault1', 'vault1')
      expect(fakeFs.has(TARGET_PATH)).toBe(true)
      expect(fakeFs.has(`${TARGET_PATH}.tmp`)).toBe(false)
    })
  })

  describe('removeRecentVault', () => {
    it('should remove a vault by path', async () => {
      seed([
        { path: '/vault1', name: 'vault1', openedAt: 100 },
        { path: '/vault2', name: 'vault2', openedAt: 200 }
      ])
      await removeRecentVault('/vault1')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/vault2')
    })

    it('should handle removing non-existent path gracefully', async () => {
      seed([{ path: '/vault1', name: 'vault1', openedAt: 100 }])
      await removeRecentVault('/does-not-exist')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
    })
  })

  describe('clearRecentVaults', () => {
    it('should write an empty array', async () => {
      seed([{ path: '/vault1', name: 'vault1', openedAt: 100 }])
      await clearRecentVaults()
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toEqual([])
    })
  })

  describe('concurrent mutations', () => {
    it('should serialize concurrent addRecentVault calls without losing entries', async () => {
      // Without the mutation queue, two adds racing on read-modify-write would
      // each start from the same initial state and the later writer would
      // clobber the earlier writer's entry. With the queue, both entries
      // survive.
      await Promise.all([
        addRecentVault('/vault-a', 'vault-a'),
        addRecentVault('/vault-b', 'vault-b')
      ])
      const result = JSON.parse(lastWrittenContent!)
      const paths = result.map((v: { path: string }) => v.path).sort()
      expect(paths).toEqual(['/vault-a', '/vault-b'])
    })

    it('should preserve all entries when many adds run concurrently', async () => {
      const adds = Array.from({ length: 5 }, (_, i) =>
        addRecentVault(`/vault${i}`, `vault${i}`)
      )
      await Promise.all(adds)
      const result = JSON.parse(lastWrittenContent!)
      const paths = result.map((v: { path: string }) => v.path).sort()
      expect(paths).toEqual(['/vault0', '/vault1', '/vault2', '/vault3', '/vault4'])
    })

    it('should serialize add followed by remove correctly', async () => {
      await Promise.all([
        addRecentVault('/vault-a', 'vault-a'),
        addRecentVault('/vault-b', 'vault-b'),
        removeRecentVault('/vault-a')
      ])
      const result = JSON.parse(lastWrittenContent!)
      const paths = result.map((v: { path: string }) => v.path)
      expect(paths).toEqual(['/vault-b'])
    })
  })
})
