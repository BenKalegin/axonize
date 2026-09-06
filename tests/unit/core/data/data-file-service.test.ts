import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, utimes, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('../../../../src/main/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() }
}))

import {
  aggregateDataFile,
  closeAllDataFiles,
  getNodeChildren,
  getRows,
  openDataFile,
  queryDataFile,
  searchDataFile
} from '../../../../src/main/data/data-file-service'
import { AggregateOp } from '@core/data/aggregate'
import { FilterOp } from '@core/data/row-query'
import { DataShape } from '@core/data/types'

const SMOKE_ROW_COUNT = 50_000

let dir: string

function jsonlLine(i: number): string {
  return JSON.stringify({ id: i, model: i % 2 === 0 ? 'opus' : 'haiku', score: i / SMOKE_ROW_COUNT })
}

async function writeTempFile(name: string, content: string): Promise<string> {
  const filePath = join(dir, name)
  await writeFile(filePath, content, 'utf-8')
  return filePath
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'axonize-data-test-'))
})

afterAll(async () => {
  closeAllDataFiles()
  await rm(dir, { recursive: true, force: true })
})

describe('data-file-service', () => {
  it('opens a large jsonl, serves windows, searches, and queries', async () => {
    const lines = Array.from({ length: SMOKE_ROW_COUNT }, (_, i) => jsonlLine(i))
    const filePath = await writeTempFile('big.jsonl', lines.join('\n') + '\n')

    const info = await openDataFile(filePath)
    expect(info.shape).toBe(DataShape.Table)
    expect(info.rowCount).toBe(SMOKE_ROW_COUNT)
    expect(info.schema.columns.map((c) => c.name)).toEqual(['id', 'model', 'score'])

    const rows = await getRows(filePath, 49_990, 10)
    expect(rows).toHaveLength(10)
    expect(rows[0].record).toMatchObject({ id: 49_990 })

    const hits = await searchDataFile(filePath, '"id":12345,')
    expect(hits.rowIndexes).toEqual([12_345])

    const result = await queryDataFile(
      filePath,
      [
        { field: 'model', op: FilterOp.Eq, value: 'opus' },
        { field: 'score', op: FilterOp.Lt, value: 0.001 }
      ],
      ['id'],
      0,
      100
    )
    expect(result.totalMatches).toBe(25)
    expect(result.rows[0].record).toEqual({ id: 0 })

    const counts = await aggregateDataFile(
      filePath,
      AggregateOp.Count,
      undefined,
      'model',
      [{ field: 'score', op: FilterOp.Lt, value: 0.001 }]
    )
    expect(counts.groups).toEqual([
      { key: 'opus', value: 25, recordCount: 25 },
      { key: 'haiku', value: 25, recordCount: 25 }
    ])
  })

  it('rebuilds the session when the file changes on disk', async () => {
    const filePath = await writeTempFile('changing.jsonl', '{"a":1}\n')
    expect((await openDataFile(filePath)).rowCount).toBe(1)

    await writeFile(filePath, '{"a":1}\n{"a":2}\n', 'utf-8')
    const future = Date.now() / 1000 + 10
    await utimes(filePath, future, future)

    expect((await openDataFile(filePath)).rowCount).toBe(2)
  })

  it('serves csv with quoted newlines as header-keyed records', async () => {
    const filePath = await writeTempFile('table.csv', 'name,note\nalice,"line one\nline two"\nbob,plain\n')
    const info = await openDataFile(filePath)
    expect(info.rowCount).toBe(2)
    expect(info.schema.columns.map((c) => c.name)).toEqual(['name', 'note'])

    const rows = await getRows(filePath, 0, 10)
    expect(rows[0].record).toEqual({ name: 'alice', note: 'line one\nline two' })
  })

  it('exposes a json object as a navigable tree', async () => {
    const filePath = await writeTempFile(
      'config.json',
      JSON.stringify({ server: { host: 'localhost', ports: [80, 443] }, debug: true })
    )
    const info = await openDataFile(filePath)
    expect(info.shape).toBe(DataShape.Tree)

    const root = await getNodeChildren(filePath, [], 0, 10)
    expect(root.map((n) => n.key)).toEqual(['server', 'debug'])
    expect(root[0].childCount).toBe(2)

    const ports = await getNodeChildren(filePath, ['server', 'ports'], 0, 10)
    expect(ports.map((n) => n.scalarValue)).toEqual([80, 443])

    const hits = await searchDataFile(filePath, 'localhost')
    expect(hits.nodePaths).toEqual(['server.host'])
  })

  it('exposes a json array of objects as a table', async () => {
    const filePath = await writeTempFile('list.json', JSON.stringify([{ a: 1 }, { a: 2 }]))
    const info = await openDataFile(filePath)
    expect(info.shape).toBe(DataShape.Table)
    expect(info.rowCount).toBe(2)
    expect((await getRows(filePath, 0, 10))[1].record).toEqual({ a: 2 })
  })

  it('rejects non-data files', async () => {
    await expect(openDataFile(join(dir, 'note.md'))).rejects.toThrow('not a data file')
  })
})
