import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockFileContent: string | null = null
let lastWrittenContent: string | null = null

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-userdata'
  }
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async () => {
    if (mockFileContent === null) throw new Error('ENOENT')
    return mockFileContent
  }),
  writeFile: vi.fn(async (_path: string, content: string) => {
    lastWrittenContent = content
    mockFileContent = content
  })
}))

import {
  getRecentVaults,
  addRecentVault,
  removeRecentVault,
  clearRecentVaults
} from '../../../src/main/recent-vaults-service'

beforeEach(() => {
  mockFileContent = null
  lastWrittenContent = null
})

describe('RecentVaultsService', () => {
  describe('getRecentVaults', () => {
    it('should return empty array when file does not exist', async () => {
      const result = await getRecentVaults()
      expect(result).toEqual([])
    })

    it('should return empty array when file contains invalid JSON', async () => {
      mockFileContent = 'not json'
      const result = await getRecentVaults()
      expect(result).toEqual([])
    })

    it('should return empty array when file contains non-array JSON', async () => {
      mockFileContent = '{"foo": "bar"}'
      const result = await getRecentVaults()
      expect(result).toEqual([])
    })

    it('should return vaults from valid JSON file', async () => {
      const vaults = [{ path: '/a', name: 'a', openedAt: 100 }]
      mockFileContent = JSON.stringify(vaults)
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
      mockFileContent = JSON.stringify([
        { path: '/vault1', name: 'vault1', openedAt: 100 }
      ])
      await addRecentVault('/vault1', 'vault1')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
      expect(result[0].openedAt).toBeGreaterThan(100)
    })

    it('should place new vault at the beginning', async () => {
      mockFileContent = JSON.stringify([
        { path: '/vault1', name: 'vault1', openedAt: 100 }
      ])
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
      mockFileContent = JSON.stringify(existing)
      await addRecentVault('/vault-new', 'vault-new')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(10)
      expect(result[0].path).toBe('/vault-new')
      expect(result[9].path).toBe('/vault8')
    })
  })

  describe('removeRecentVault', () => {
    it('should remove a vault by path', async () => {
      mockFileContent = JSON.stringify([
        { path: '/vault1', name: 'vault1', openedAt: 100 },
        { path: '/vault2', name: 'vault2', openedAt: 200 }
      ])
      await removeRecentVault('/vault1')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/vault2')
    })

    it('should handle removing non-existent path gracefully', async () => {
      mockFileContent = JSON.stringify([
        { path: '/vault1', name: 'vault1', openedAt: 100 }
      ])
      await removeRecentVault('/does-not-exist')
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toHaveLength(1)
    })
  })

  describe('clearRecentVaults', () => {
    it('should write an empty array', async () => {
      mockFileContent = JSON.stringify([
        { path: '/vault1', name: 'vault1', openedAt: 100 }
      ])
      await clearRecentVaults()
      const result = JSON.parse(lastWrittenContent!)
      expect(result).toEqual([])
    })
  })
})
