import { describe, it, expect } from 'vitest'
import { aggregateRecords, AggregateOp, ALL_GROUP_KEY, MISSING_GROUP_KEY } from '@core/data/aggregate'

const RECORDS = [
  { model: 'opus', score: 0.9 },
  { model: 'opus', score: 0.5 },
  { model: 'haiku', score: 0.3 },
  { model: 'haiku', score: 0.7 },
  { model: 'haiku', score: 0.2 }
]

const NO_GROUP_CAP = 100

describe('aggregate', () => {
  it('counts all records into a single group without groupBy', () => {
    const result = aggregateRecords(RECORDS, AggregateOp.Count, undefined, undefined, NO_GROUP_CAP)
    expect(result.groups).toEqual([{ key: ALL_GROUP_KEY, value: 5, recordCount: 5 }])
    expect(result.truncated).toBe(false)
  })

  it('counts grouped records in first-seen order', () => {
    const result = aggregateRecords(RECORDS, AggregateOp.Count, undefined, 'model', NO_GROUP_CAP)
    expect(result.groups).toEqual([
      { key: 'opus', value: 2, recordCount: 2 },
      { key: 'haiku', value: 3, recordCount: 3 }
    ])
  })

  it('computes sum, min, and max per group', () => {
    const sum = aggregateRecords(RECORDS, AggregateOp.Sum, 'score', 'model', NO_GROUP_CAP)
    expect(sum.groups.map((g) => [g.key, g.value])).toEqual([
      ['opus', 0.9 + 0.5],
      ['haiku', 0.3 + 0.7 + 0.2]
    ])

    const min = aggregateRecords(RECORDS, AggregateOp.Min, 'score', undefined, NO_GROUP_CAP)
    expect(min.groups[0].value).toBe(0.2)

    const max = aggregateRecords(RECORDS, AggregateOp.Max, 'score', undefined, NO_GROUP_CAP)
    expect(max.groups[0].value).toBe(0.9)
  })

  it('ignores non-numeric field values but still counts the record', () => {
    const records = [{ v: 1 }, { v: 'oops' }, { v: 3 }]
    const result = aggregateRecords(records, AggregateOp.Sum, 'v', undefined, NO_GROUP_CAP)
    expect(result.groups[0]).toEqual({ key: ALL_GROUP_KEY, value: 4, recordCount: 3 })
  })

  it('yields null value when no numeric values were seen', () => {
    const result = aggregateRecords([{ v: 'x' }], AggregateOp.Min, 'v', undefined, NO_GROUP_CAP)
    expect(result.groups[0].value).toBeNull()
  })

  it('buckets records missing the groupBy field separately', () => {
    const records = [{ model: 'opus' }, { other: 1 }]
    const result = aggregateRecords(records, AggregateOp.Count, undefined, 'model', NO_GROUP_CAP)
    expect(result.groups.map((g) => g.key)).toEqual(['opus', MISSING_GROUP_KEY])
  })

  it('drops new groups past the cap and marks the result truncated', () => {
    const records = [{ k: 'a' }, { k: 'b' }, { k: 'c' }, { k: 'a' }]
    const result = aggregateRecords(records, AggregateOp.Count, undefined, 'k', 2)
    expect(result.groups).toEqual([
      { key: 'a', value: 2, recordCount: 2 },
      { key: 'b', value: 1, recordCount: 1 }
    ])
    expect(result.truncated).toBe(true)
  })
})
