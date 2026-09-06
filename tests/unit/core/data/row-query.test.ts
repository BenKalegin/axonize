import { describe, it, expect } from 'vitest'
import { FilterOp, matchesFilters, projectRecord } from '@core/data/row-query'

describe('row-query', () => {
  const record = { name: 'Alice', score: 0.7, active: true, tags: ['a', 'b'] }

  describe('matchesFilters', () => {
    it('matches eq strictly', () => {
      expect(matchesFilters(record, [{ field: 'name', op: FilterOp.Eq, value: 'Alice' }])).toBe(true)
      expect(matchesFilters(record, [{ field: 'score', op: FilterOp.Eq, value: '0.7' }])).toBe(false)
    })

    it('matches neq', () => {
      expect(matchesFilters(record, [{ field: 'name', op: FilterOp.Neq, value: 'Bob' }])).toBe(true)
    })

    it('matches contains case-insensitively', () => {
      expect(matchesFilters(record, [{ field: 'name', op: FilterOp.Contains, value: 'ali' }])).toBe(true)
      expect(matchesFilters(record, [{ field: 'name', op: FilterOp.Contains, value: 'zzz' }])).toBe(false)
    })

    it('matches contains over stringified non-string values', () => {
      expect(matchesFilters(record, [{ field: 'tags', op: FilterOp.Contains, value: 'b' }])).toBe(true)
    })

    it('matches gt/lt for numbers', () => {
      expect(matchesFilters(record, [{ field: 'score', op: FilterOp.Gt, value: 0.5 }])).toBe(true)
      expect(matchesFilters(record, [{ field: 'score', op: FilterOp.Lt, value: 0.5 }])).toBe(false)
    })

    it('matches gt/lt for strings', () => {
      expect(matchesFilters(record, [{ field: 'name', op: FilterOp.Gt, value: 'Aaa' }])).toBe(true)
    })

    it('never matches gt/lt across mismatched types', () => {
      expect(matchesFilters(record, [{ field: 'score', op: FilterOp.Gt, value: 'high' }])).toBe(false)
      expect(matchesFilters(record, [{ field: 'name', op: FilterOp.Lt, value: 5 }])).toBe(false)
    })

    it('matches exists on present fields only', () => {
      expect(matchesFilters(record, [{ field: 'score', op: FilterOp.Exists }])).toBe(true)
      expect(matchesFilters(record, [{ field: 'missing', op: FilterOp.Exists }])).toBe(false)
    })

    it('requires all filters to match (AND)', () => {
      expect(
        matchesFilters(record, [
          { field: 'active', op: FilterOp.Eq, value: true },
          { field: 'score', op: FilterOp.Gt, value: 0.9 }
        ])
      ).toBe(false)
    })

    it('matches everything with an empty filter list', () => {
      expect(matchesFilters(record, [])).toBe(true)
    })
  })

  describe('projectRecord', () => {
    it('keeps only selected fields', () => {
      expect(projectRecord(record, ['name', 'score'])).toEqual({ name: 'Alice', score: 0.7 })
    })

    it('ignores unknown selected fields', () => {
      expect(projectRecord(record, ['name', 'missing'])).toEqual({ name: 'Alice' })
    })

    it('returns the full record without a selection', () => {
      expect(projectRecord(record)).toBe(record)
      expect(projectRecord(record, [])).toBe(record)
    })
  })
})
