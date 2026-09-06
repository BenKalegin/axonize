import type { DataRecord } from './types'
import { stringifyValue } from './row-query'

export const AggregateOp = {
  Count: 'count',
  Min: 'min',
  Max: 'max',
  Sum: 'sum'
} as const
export type AggregateOp = (typeof AggregateOp)[keyof typeof AggregateOp]

/** Group key used for records where the groupBy field is absent. */
export const MISSING_GROUP_KEY = '(missing)'
/** Key of the single group returned when no groupBy is given. */
export const ALL_GROUP_KEY = '(all)'

export interface AggregateGroup {
  key: string
  /** Aggregated value; null when no numeric values were seen (min/max/sum of nothing). */
  value: number | null
  /** Records that landed in this group (counted even when their field value was non-numeric). */
  recordCount: number
}

export interface AggregateResult {
  groups: AggregateGroup[]
  /** True when the group cap was hit; groups beyond the cap were dropped. */
  truncated: boolean
}

interface GroupAccumulator {
  value: number | null
  recordCount: number
}

type Accumulate = (acc: GroupAccumulator, fieldValue: unknown) => void

const ACCUMULATORS: Record<AggregateOp, Accumulate> = {
  [AggregateOp.Count]: (acc) => {
    acc.value = (acc.value ?? 0) + 1
  },
  [AggregateOp.Sum]: (acc, v) => {
    if (typeof v === 'number') acc.value = (acc.value ?? 0) + v
  },
  [AggregateOp.Min]: (acc, v) => {
    if (typeof v === 'number') acc.value = acc.value === null ? v : Math.min(acc.value, v)
  },
  [AggregateOp.Max]: (acc, v) => {
    if (typeof v === 'number') acc.value = acc.value === null ? v : Math.max(acc.value, v)
  }
}

/**
 * Single-pass grouped aggregation. Non-numeric field values are ignored by
 * min/max/sum but still counted in `recordCount`. Groups are returned in
 * first-seen order; once `maxGroups` distinct keys exist, records belonging
 * to new keys are dropped and the result is marked truncated.
 */
export function aggregateRecords(
  records: Iterable<DataRecord>,
  op: AggregateOp,
  field: string | undefined,
  groupBy: string | undefined,
  maxGroups: number
): AggregateResult {
  const groups = new Map<string, GroupAccumulator>()
  const accumulate = ACCUMULATORS[op]
  let truncated = false

  for (const record of records) {
    const key = groupKeyOf(record, groupBy)
    let acc = groups.get(key)
    if (!acc) {
      if (groups.size >= maxGroups) {
        truncated = true
        continue
      }
      acc = { value: null, recordCount: 0 }
      groups.set(key, acc)
    }
    acc.recordCount++
    accumulate(acc, field === undefined ? undefined : record[field])
  }

  return {
    groups: [...groups.entries()].map(([key, acc]) => ({
      key,
      value: acc.value,
      recordCount: acc.recordCount
    })),
    truncated
  }
}

function groupKeyOf(record: DataRecord, groupBy: string | undefined): string {
  if (groupBy === undefined) return ALL_GROUP_KEY
  return groupBy in record ? stringifyValue(record[groupBy]) : MISSING_GROUP_KEY
}
