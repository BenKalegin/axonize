import type { DataFileKind } from '../vault/data-file-types'

export const DataShape = {
  Table: 'table',
  Tree: 'tree'
} as const
export type DataShape = (typeof DataShape)[keyof typeof DataShape]

export const DataValueType = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Null: 'null',
  Object: 'object',
  Array: 'array',
  Mixed: 'mixed'
} as const
export type DataValueType = (typeof DataValueType)[keyof typeof DataValueType]

export interface DataColumnSchema {
  name: string
  type: DataValueType
  example?: string
}

export interface DataSchema {
  columns: DataColumnSchema[]
}

export type DataRecord = Record<string, unknown>

/** Character span of one logical record inside the source text. */
export interface RowSpan {
  start: number
  end: number
}

/** A lazily parsed record; `error` is set instead of throwing on malformed rows. */
export interface ParsedRecord {
  value: unknown
  error: string | null
}

/** One child of a JSON tree node, summarized without materializing its subtree. */
export interface JsonNodeSummary {
  key: string
  type: DataValueType
  scalarValue?: string | number | boolean | null
  childCount?: number
}

export interface DataSessionInfo {
  kind: DataFileKind
  shape: DataShape
  rowCount: number
  byteSize: number
  schema: DataSchema
}

export interface DataRowResult {
  index: number
  record: DataRecord
  error: string | null
}

export interface DataSearchResult {
  /** Matching row indexes (table shape). */
  rowIndexes: number[]
  /** Matching node paths as dotted segments (tree shape). */
  nodePaths: string[]
  truncated: boolean
}

export function dataValueTypeOf(value: unknown): DataValueType {
  if (value === null || value === undefined) return DataValueType.Null
  if (Array.isArray(value)) return DataValueType.Array
  const t = typeof value
  if (t === 'number') return DataValueType.Number
  if (t === 'boolean') return DataValueType.Boolean
  if (t === 'object') return DataValueType.Object
  return DataValueType.String
}
