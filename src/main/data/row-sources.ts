import { DataFileKind } from '../../core/vault/data-file-types'
import type {
  DataRecord,
  DataSchema,
  JsonNodeSummary,
  ParsedRecord,
  RowSpan
} from '../../core/data/types'
import { DataShape, DataValueType, dataValueTypeOf } from '../../core/data/types'
import { indexCsv, parseCsvRecord, stripBom, type CsvIndex } from '../../core/data/csv-parser'
import { indexJsonl, parseJsonlRecord } from '../../core/data/jsonl-index'
import {
  inferSchema,
  isPlainObject,
  SCALAR_COLUMN_NAME,
  SCHEMA_SAMPLE_ROWS
} from '../../core/data/schema-inference'
import { stringifyValue } from '../../core/data/row-query'

const TREE_PATH_SEPARATOR = '.'

export interface RowSearchHits {
  indexes: number[]
  truncated: boolean
}

export interface NodeSearchHits {
  paths: string[]
  truncated: boolean
}

/** Windowed access to one parsed data file, lazy per row where the format allows. */
export interface RowSource {
  readonly shape: DataShape
  readonly rowCount: number
  readonly schema: DataSchema
  /** Table shape only. */
  record(index: number): ParsedRecord
  /** Table shape only; raw-text scan, case-insensitive. */
  searchRows(text: string, limit: number): RowSearchHits
  /** Tree navigation; available for JSON sources. */
  children?(path: Array<string | number>, offset: number, limit: number): JsonNodeSummary[]
  searchNodes?(text: string, limit: number): NodeSearchHits
}

type SourceBuilder = (text: string) => RowSource

const SOURCE_BUILDERS: Record<DataFileKind, SourceBuilder> = {
  [DataFileKind.Csv]: buildCsvSource,
  [DataFileKind.Jsonl]: buildJsonlSource,
  [DataFileKind.Json]: buildJsonSource
}

export function createRowSource(kind: DataFileKind, rawText: string): RowSource {
  return SOURCE_BUILDERS[kind](stripBom(rawText))
}

// --- CSV ---

function buildCsvSource(text: string): RowSource {
  const index = indexCsv(text)
  return {
    shape: DataShape.Table,
    rowCount: index.rowSpans.length,
    schema: csvSchema(text, index),
    record: (i) => ({ value: csvRecordAt(text, index, i), error: null }),
    searchRows: (q, limit) => searchSpans(text, index.rowSpans, q, limit)
  }
}

function csvRecordAt(text: string, index: CsvIndex, rowIndex: number): DataRecord {
  const span = index.rowSpans[rowIndex]
  const fields = parseCsvRecord(text.slice(span.start, span.end))
  const record: DataRecord = {}
  index.headers.forEach((header, i) => {
    record[header] = fields[i] ?? ''
  })
  return record
}

/** CSV is untyped: every column is a string; examples come from the sample rows. */
function csvSchema(text: string, index: CsvIndex): DataSchema {
  const sampled = inferSchema(
    index.rowSpans.slice(0, SCHEMA_SAMPLE_ROWS).map((_, i) => csvRecordAt(text, index, i))
  )
  const examples = new Map(sampled.columns.map((c) => [c.name, c.example]))
  return {
    columns: index.headers.map((name) => ({
      name,
      type: DataValueType.String,
      example: examples.get(name)
    }))
  }
}

// --- JSONL ---

function buildJsonlSource(text: string): RowSource {
  const spans = indexJsonl(text)
  const record = (i: number): ParsedRecord => {
    const parsed = parseJsonlRecord(text, spans[i])
    return parsed.error ? parsed : { value: asRecord(parsed.value), error: null }
  }
  return {
    shape: DataShape.Table,
    rowCount: spans.length,
    schema: sampledSchema(spans.length, (i) => parseJsonlRecord(text, spans[i])),
    record,
    searchRows: (q, limit) => searchSpans(text, spans, q, limit)
  }
}

function sampledSchema(rowCount: number, parse: (index: number) => ParsedRecord): DataSchema {
  const sample: unknown[] = []
  const sampleSize = Math.min(rowCount, SCHEMA_SAMPLE_ROWS)
  for (let i = 0; i < sampleSize; i++) {
    const parsed = parse(i)
    if (!parsed.error) sample.push(parsed.value)
  }
  return inferSchema(sample)
}

/** Non-object records (scalars/arrays) are presented as a single `value` column. */
function asRecord(value: unknown): DataRecord {
  return isPlainObject(value) ? value : { [SCALAR_COLUMN_NAME]: value }
}

function searchSpans(text: string, spans: RowSpan[], query: string, limit: number): RowSearchHits {
  const needle = query.toLowerCase()
  const indexes: number[] = []
  for (let i = 0; i < spans.length; i++) {
    if (text.slice(spans[i].start, spans[i].end).toLowerCase().includes(needle)) {
      if (indexes.length >= limit) return { indexes, truncated: true }
      indexes.push(i)
    }
  }
  return { indexes, truncated: false }
}

// --- JSON ---

function buildJsonSource(text: string): RowSource {
  const root: unknown = JSON.parse(text)
  return Array.isArray(root) ? buildJsonArraySource(root) : buildJsonTreeSource(root)
}

function buildJsonArraySource(root: unknown[]): RowSource {
  return {
    shape: DataShape.Table,
    rowCount: root.length,
    schema: inferSchema(root.slice(0, SCHEMA_SAMPLE_ROWS)),
    record: (i) => ({ value: asRecord(root[i]), error: null }),
    searchRows: (q, limit) => searchJsonRows(root, q, limit),
    children: (path, offset, limit) => childrenAt(root, path, offset, limit),
    searchNodes: (q, limit) => searchJsonNodes(root, q, limit)
  }
}

function buildJsonTreeSource(root: unknown): RowSource {
  return {
    shape: DataShape.Tree,
    rowCount: containerSize(root),
    schema: { columns: [] },
    record: () => ({ value: null, error: 'record access is not available for tree-shaped JSON' }),
    searchRows: () => ({ indexes: [], truncated: false }),
    children: (path, offset, limit) => childrenAt(root, path, offset, limit),
    searchNodes: (q, limit) => searchJsonNodes(root, q, limit)
  }
}

function searchJsonRows(root: unknown[], query: string, limit: number): RowSearchHits {
  const needle = query.toLowerCase()
  const indexes: number[] = []
  for (let i = 0; i < root.length; i++) {
    if (stringifyValue(root[i]).toLowerCase().includes(needle)) {
      if (indexes.length >= limit) return { indexes, truncated: true }
      indexes.push(i)
    }
  }
  return { indexes, truncated: false }
}

function childrenAt(
  root: unknown,
  path: Array<string | number>,
  offset: number,
  limit: number
): JsonNodeSummary[] {
  const node = navigate(root, path)
  if (Array.isArray(node)) {
    return node
      .slice(offset, offset + limit)
      .map((value, i) => summarizeNode(String(offset + i), value))
  }
  if (isPlainObject(node)) {
    return Object.entries(node)
      .slice(offset, offset + limit)
      .map(([key, value]) => summarizeNode(key, value))
  }
  return []
}

function navigate(root: unknown, path: Array<string | number>): unknown {
  let node = root
  for (const segment of path) {
    if (Array.isArray(node)) {
      node = node[Number(segment)]
    } else if (isPlainObject(node)) {
      node = node[String(segment)]
    } else {
      throw new Error(`invalid node path: ${path.join(TREE_PATH_SEPARATOR)}`)
    }
  }
  return node
}

function summarizeNode(key: string, value: unknown): JsonNodeSummary {
  const type = dataValueTypeOf(value)
  if (type === DataValueType.Object || type === DataValueType.Array) {
    return { key, type, childCount: containerSize(value) }
  }
  return { key, type, scalarValue: (value ?? null) as JsonNodeSummary['scalarValue'] }
}

function containerSize(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (isPlainObject(value)) return Object.keys(value).length
  return 0
}

/** DFS over the parsed tree; matches on key or stringified scalar value. */
function searchJsonNodes(root: unknown, query: string, limit: number): NodeSearchHits {
  const needle = query.toLowerCase()
  const paths: string[] = []
  const stack: Array<{ path: string[]; value: unknown }> = [{ path: [], value: root }]

  while (stack.length > 0) {
    const { path, value } = stack.pop()!
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : isPlainObject(value)
        ? Object.entries(value)
        : []

    for (const [key, child] of entries) {
      const childPath = [...path, key]
      const isContainer = Array.isArray(child) || isPlainObject(child)
      const matches = key.toLowerCase().includes(needle) ||
        (!isContainer && stringifyValue(child).toLowerCase().includes(needle))
      if (matches) {
        if (paths.length >= limit) return { paths, truncated: true }
        paths.push(childPath.join(TREE_PATH_SEPARATOR))
      }
      if (isContainer) stack.push({ path: childPath, value: child })
    }
  }
  return { paths, truncated: false }
}
