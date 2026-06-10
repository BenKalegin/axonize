import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import type {
  DataRecord,
  DataRowResult,
  DataSearchResult,
  DataSessionInfo,
  JsonNodeSummary
} from '../../core/data/types'
import { DataShape } from '../../core/data/types'
import type { FieldFilter } from '../../core/data/row-query'
import { matchesFilters, projectRecord } from '../../core/data/row-query'
import { aggregateRecords, type AggregateOp, type AggregateResult } from '../../core/data/aggregate'
import { dataFileKindOf, type DataFileKind } from '../../core/vault/data-file-types'
import { createRowSource, type RowSource } from './row-sources'
import log from '../logger'

/** V8 strings cap near 512MB chars; stay well under since we hold the file as one string. */
const MAX_DATA_FILE_BYTES = 256 * 1024 * 1024
const MAX_OPEN_SESSIONS = 4
const MAX_ROWS_PER_REQUEST = 500
const MAX_SEARCH_RESULTS = 1000
const MAX_AGGREGATE_GROUPS = 100

interface Session {
  kind: DataFileKind
  mtimeMs: number
  byteSize: number
  source: RowSource
  lastAccess: number
}

const sessions = new Map<string, Session>()

export interface QueryRowsResult {
  rows: DataRowResult[]
  totalMatches: number
}

/** Idempotent: cached by path, transparently rebuilt when the file's mtime/size changes. */
export async function openDataFile(filePath: string): Promise<DataSessionInfo> {
  const session = await ensureSession(filePath)
  return {
    kind: session.kind,
    shape: session.source.shape,
    rowCount: session.source.rowCount,
    byteSize: session.byteSize,
    schema: session.source.schema
  }
}

export async function getRows(
  filePath: string,
  offset: number,
  limit: number
): Promise<DataRowResult[]> {
  const { source } = await ensureSession(filePath)
  const end = Math.min(offset + Math.min(limit, MAX_ROWS_PER_REQUEST), source.rowCount)
  const rows: DataRowResult[] = []
  for (let i = Math.max(offset, 0); i < end; i++) {
    rows.push(rowAt(source, i))
  }
  return rows
}

export async function getNodeChildren(
  filePath: string,
  path: Array<string | number>,
  offset: number,
  limit: number
): Promise<JsonNodeSummary[]> {
  const { source } = await ensureSession(filePath)
  if (!source.children) {
    throw new Error(`tree navigation is not supported for ${basename(filePath)}`)
  }
  return source.children(path, Math.max(offset, 0), Math.min(limit, MAX_ROWS_PER_REQUEST))
}

export async function searchDataFile(filePath: string, text: string): Promise<DataSearchResult> {
  const { source } = await ensureSession(filePath)
  if (source.shape === DataShape.Tree) {
    const hits = source.searchNodes!(text, MAX_SEARCH_RESULTS)
    return { rowIndexes: [], nodePaths: hits.paths, truncated: hits.truncated }
  }
  const hits = source.searchRows(text, MAX_SEARCH_RESULTS)
  return { rowIndexes: hits.indexes, nodePaths: [], truncated: hits.truncated }
}

/** Linear scan with structured filters; rows with parse errors never match. */
export async function queryDataFile(
  filePath: string,
  filters: FieldFilter[],
  select: string[] | undefined,
  offset: number,
  limit: number
): Promise<QueryRowsResult> {
  const { source } = await ensureSession(filePath)
  const cappedLimit = Math.min(limit, MAX_ROWS_PER_REQUEST)
  const rows: DataRowResult[] = []
  let totalMatches = 0

  for (let i = 0; i < source.rowCount; i++) {
    const row = rowAt(source, i)
    if (row.error || !matchesFilters(row.record, filters)) continue
    if (totalMatches >= offset && rows.length < cappedLimit) {
      rows.push({ ...row, record: projectRecord(row.record, select) })
    }
    totalMatches++
  }
  return { rows, totalMatches }
}

/** Grouped aggregation over (optionally filtered) rows; rows with parse errors are skipped. */
export async function aggregateDataFile(
  filePath: string,
  op: AggregateOp,
  field: string | undefined,
  groupBy: string | undefined,
  filters: FieldFilter[]
): Promise<AggregateResult> {
  const { source } = await ensureSession(filePath)
  const matchingRecords = function* (): Generator<DataRecord> {
    for (let i = 0; i < source.rowCount; i++) {
      const row = rowAt(source, i)
      if (row.error || !matchesFilters(row.record, filters)) continue
      yield row.record
    }
  }
  return aggregateRecords(matchingRecords(), op, field, groupBy, MAX_AGGREGATE_GROUPS)
}

export function closeDataFile(filePath: string): void {
  sessions.delete(filePath)
}

export function closeAllDataFiles(): void {
  sessions.clear()
}

function rowAt(source: RowSource, index: number): DataRowResult {
  const parsed = source.record(index)
  return parsed.error
    ? { index, record: {}, error: parsed.error }
    : { index, record: parsed.value as DataRecord, error: null }
}

async function ensureSession(filePath: string): Promise<Session> {
  const kind = dataFileKindOf(filePath)
  if (!kind) throw new Error(`not a data file: ${basename(filePath)}`)

  const stats = await stat(filePath)
  const cached = sessions.get(filePath)
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.byteSize === stats.size) {
    cached.lastAccess = Date.now()
    return cached
  }

  if (stats.size > MAX_DATA_FILE_BYTES) {
    throw new Error(
      `${basename(filePath)} is ${stats.size} bytes; data files over ${MAX_DATA_FILE_BYTES} bytes are not supported`
    )
  }

  const text = await readFile(filePath, 'utf-8')
  const session: Session = {
    kind,
    mtimeMs: stats.mtimeMs,
    byteSize: stats.size,
    source: createRowSource(kind, text),
    lastAccess: Date.now()
  }
  sessions.set(filePath, session)
  evictStaleSessions()
  log.info(`[data-file-service] opened ${filePath} (${session.source.rowCount} rows)`)
  return session
}

function evictStaleSessions(): void {
  while (sessions.size > MAX_OPEN_SESSIONS) {
    let oldestPath: string | null = null
    let oldestAccess = Infinity
    for (const [path, session] of sessions) {
      if (session.lastAccess < oldestAccess) {
        oldestAccess = session.lastAccess
        oldestPath = path
      }
    }
    if (!oldestPath) return
    sessions.delete(oldestPath)
    log.info(`[data-file-service] evicted ${oldestPath}`)
  }
}
