import type { DataRecord } from './types'

export const FilterOp = {
  Eq: 'eq',
  Neq: 'neq',
  Contains: 'contains',
  Gt: 'gt',
  Lt: 'lt',
  Exists: 'exists'
} as const
export type FilterOp = (typeof FilterOp)[keyof typeof FilterOp]

export type FilterValue = string | number | boolean | null

export interface FieldFilter {
  field: string
  op: FilterOp
  value?: FilterValue
}

type FilterPredicate = (fieldValue: unknown, filterValue: FilterValue | undefined) => boolean

const PREDICATES: Record<FilterOp, FilterPredicate> = {
  [FilterOp.Eq]: (fv, v) => fv === v,
  [FilterOp.Neq]: (fv, v) => fv !== v,
  [FilterOp.Contains]: (fv, v) =>
    fv !== undefined && v !== undefined && v !== null &&
    stringifyValue(fv).toLowerCase().includes(String(v).toLowerCase()),
  [FilterOp.Gt]: (fv, v) => compareOrdered(fv, v) > 0,
  [FilterOp.Lt]: (fv, v) => compareOrdered(fv, v) < 0,
  [FilterOp.Exists]: (fv) => fv !== undefined
}

/** All filters must match (AND semantics). `contains` is case-insensitive. */
export function matchesFilters(record: DataRecord, filters: FieldFilter[]): boolean {
  return filters.every((f) => PREDICATES[f.op](record[f.field], f.value))
}

/** Keep only `select`ed fields; no `select` means the full record. */
export function projectRecord(record: DataRecord, select?: string[]): DataRecord {
  if (!select || select.length === 0) return record
  const projected: DataRecord = {}
  for (const field of select) {
    if (field in record) projected[field] = record[field]
  }
  return projected
}

export function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? ''
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Strict same-type ordering: numbers with numbers, strings with strings; otherwise no match. */
function compareOrdered(fieldValue: unknown, filterValue: FilterValue | undefined): number {
  if (typeof fieldValue === 'number' && typeof filterValue === 'number') {
    return Math.sign(fieldValue - filterValue)
  }
  if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
    return fieldValue < filterValue ? -1 : fieldValue > filterValue ? 1 : 0
  }
  return NaN
}
