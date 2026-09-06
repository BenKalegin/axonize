import { describe, it, expect } from 'vitest'
import { inferSchema, SCALAR_COLUMN_NAME } from '@core/data/schema-inference'
import { DataValueType } from '@core/data/types'

function columnByName(schema: ReturnType<typeof inferSchema>, name: string) {
  return schema.columns.find((c) => c.name === name)
}

describe('schema-inference', () => {
  it('unions keys across records', () => {
    const schema = inferSchema([{ a: 1 }, { b: 'x' }, { a: 2, c: true }])
    expect(schema.columns.map((c) => c.name).sort()).toEqual(['a', 'b', 'c'])
  })

  it('infers value types per column', () => {
    const schema = inferSchema([{ s: 'x', n: 1, b: true, o: { k: 1 }, arr: [1] }])
    expect(columnByName(schema, 's')?.type).toBe(DataValueType.String)
    expect(columnByName(schema, 'n')?.type).toBe(DataValueType.Number)
    expect(columnByName(schema, 'b')?.type).toBe(DataValueType.Boolean)
    expect(columnByName(schema, 'o')?.type).toBe(DataValueType.Object)
    expect(columnByName(schema, 'arr')?.type).toBe(DataValueType.Array)
  })

  it('marks conflicting types as mixed', () => {
    const schema = inferSchema([{ a: 1 }, { a: 'two' }])
    expect(columnByName(schema, 'a')?.type).toBe(DataValueType.Mixed)
  })

  it('upgrades null to a concrete type when seen later', () => {
    const schema = inferSchema([{ a: null }, { a: 5 }])
    expect(columnByName(schema, 'a')?.type).toBe(DataValueType.Number)
  })

  it('keeps null type when only nulls are seen', () => {
    const schema = inferSchema([{ a: null }, { a: null }])
    expect(columnByName(schema, 'a')?.type).toBe(DataValueType.Null)
  })

  it('captures an example value, truncated when long', () => {
    const long = 'x'.repeat(200)
    const schema = inferSchema([{ a: long, b: 7 }])
    expect(columnByName(schema, 'a')?.example?.length).toBeLessThan(100)
    expect(columnByName(schema, 'b')?.example).toBe('7')
  })

  it('maps non-object records to a single scalar column', () => {
    const schema = inferSchema([1, 2, 3])
    expect(schema.columns).toHaveLength(1)
    expect(schema.columns[0].name).toBe(SCALAR_COLUMN_NAME)
    expect(schema.columns[0].type).toBe(DataValueType.Number)
  })
})
