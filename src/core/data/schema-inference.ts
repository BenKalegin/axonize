import type { DataColumnSchema, DataSchema } from './types'
import { DataValueType, dataValueTypeOf } from './types'

/** Number of leading records sampled when inferring a schema. */
export const SCHEMA_SAMPLE_ROWS = 200
const EXAMPLE_MAX_CHARS = 80

/** Column name used when records are not plain objects (scalar/array JSONL). */
export const SCALAR_COLUMN_NAME = 'value'

/**
 * Infer a shallow schema from sampled records: union of top-level keys with a
 * per-key value type (`mixed` on conflict) and one example value per column.
 */
export function inferSchema(sampleRecords: unknown[]): DataSchema {
  const columns = new Map<string, DataColumnSchema>()

  for (const record of sampleRecords) {
    if (isPlainObject(record)) {
      for (const [key, value] of Object.entries(record)) {
        mergeColumn(columns, key, value)
      }
    } else {
      mergeColumn(columns, SCALAR_COLUMN_NAME, record)
    }
  }
  return { columns: [...columns.values()] }
}

function mergeColumn(columns: Map<string, DataColumnSchema>, name: string, value: unknown): void {
  const type = dataValueTypeOf(value)
  const existing = columns.get(name)

  if (!existing) {
    columns.set(name, { name, type, example: exampleOf(value) })
    return
  }
  if (existing.type !== type && type !== DataValueType.Null) {
    existing.type = existing.type === DataValueType.Null ? type : DataValueType.Mixed
  }
  if (existing.example === undefined) {
    existing.example = exampleOf(value)
  }
}

function exampleOf(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = typeof value === 'string' ? value : safeStringify(value)
  return text.length > EXAMPLE_MAX_CHARS ? `${text.slice(0, EXAMPLE_MAX_CHARS)}…` : text
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
