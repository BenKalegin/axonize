import { describe, it, expect } from 'vitest'
import { buildDataSchemaCard, dataSchemaBlockId } from '@core/rag/data-schema-card'
import type { DataSessionInfo } from '@core/data/types'

function info(overrides: Partial<DataSessionInfo> = {}): DataSessionInfo {
  return {
    kind: 'jsonl',
    shape: 'table',
    rowCount: 1234,
    byteSize: 250_000,
    schema: {
      columns: [
        { name: 'score', type: 'number', example: '0.85' },
        { name: 'model', type: 'string', example: 'gpt-4o' },
        { name: 'meta', type: 'object' }
      ]
    },
    ...overrides
  }
}

describe('buildDataSchemaCard', () => {
  it('includes path, format, row count, and size', () => {
    const card = buildDataSchemaCard('agent/evals.jsonl', info(), [])
    expect(card).toContain('Data file: agent/evals.jsonl')
    expect(card).toContain('jsonl (table), 1234 records, 244 KB')
  })

  it('lists columns with types and examples', () => {
    const card = buildDataSchemaCard('agent/evals.jsonl', info(), [])
    expect(card).toContain('score: number (e.g. 0.85)')
    expect(card).toContain('model: string (e.g. gpt-4o)')
    expect(card).toContain('meta: object')
  })

  it('includes sample records as JSON', () => {
    const card = buildDataSchemaCard('a.csv', info({ kind: 'csv' }), [
      { score: 0.85, model: 'gpt-4o' }
    ])
    expect(card).toContain('Sample record: {"score":0.85,"model":"gpt-4o"}')
  })

  it('truncates very long sample records', () => {
    const card = buildDataSchemaCard('a.jsonl', info(), [{ text: 'x'.repeat(2000) }])
    const sampleLine = card.split('\n').find((l) => l.startsWith('Sample record:'))!
    expect(sampleLine.length).toBeLessThanOrEqual('Sample record: '.length + 300)
  })

  it('omits the columns line when the schema is empty', () => {
    const card = buildDataSchemaCard('tree.json', info({ shape: 'tree', schema: { columns: [] } }), [])
    expect(card).not.toContain('Columns:')
  })

  it('caps the listed columns and notes the overflow', () => {
    const columns = Array.from({ length: 50 }, (_, i) => ({ name: `col${i}`, type: 'string' as const }))
    const card = buildDataSchemaCard('wide.csv', info({ schema: { columns } }), [])
    expect(card).toContain('… 10 more')
    expect(card).not.toContain('col45')
  })

  it('points the agent at the data tools', () => {
    const card = buildDataSchemaCard('a.csv', info(), [])
    expect(card).toMatch(/data_schema, data_query, and data_aggregate/)
  })

  it('formats sizes in human units', () => {
    expect(buildDataSchemaCard('a.csv', info({ byteSize: 512 }), [])).toContain('512 B')
    expect(buildDataSchemaCard('a.csv', info({ byteSize: 5 * 1024 * 1024 }), [])).toContain('5.0 MB')
  })
})

describe('dataSchemaBlockId', () => {
  it('is stable and path-scoped', () => {
    expect(dataSchemaBlockId('agent/evals.jsonl')).toBe('data-schema:agent/evals.jsonl')
  })
})
