import type { DataRecord, DataSessionInfo } from '../data/types'

// Block type used for synthetic data-file schema chunks in the RAG index.
export const DATA_SCHEMA_BLOCK_TYPE = 'data-schema'

const MAX_COLUMNS_LISTED = 40
const MAX_SAMPLE_CHARS = 300
const BYTES_PER_KB = 1024

export function dataSchemaBlockId(relativePath: string): string {
  return `${DATA_SCHEMA_BLOCK_TYPE}:${relativePath}`
}

function humanSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`
  if (bytes < BYTES_PER_KB * BYTES_PER_KB) return `${Math.round(bytes / BYTES_PER_KB)} KB`
  return `${(bytes / (BYTES_PER_KB * BYTES_PER_KB)).toFixed(1)} MB`
}

function describeColumns(info: DataSessionInfo): string {
  const cols = info.schema.columns
  if (cols.length === 0) return ''
  const listed = cols
    .slice(0, MAX_COLUMNS_LISTED)
    .map((c) => (c.example !== undefined ? `${c.name}: ${c.type} (e.g. ${c.example})` : `${c.name}: ${c.type}`))
  const overflow = cols.length > MAX_COLUMNS_LISTED ? `; … ${cols.length - MAX_COLUMNS_LISTED} more` : ''
  return `Columns: ${listed.join('; ')}${overflow}.`
}

function describeSamples(samples: DataRecord[]): string {
  return samples
    .map((record) => `Sample record: ${JSON.stringify(record).slice(0, MAX_SAMPLE_CHARS)}`)
    .join('\n')
}

/**
 * One embedding-friendly text card describing a data file's shape so that
 * rag_query routes the agent to the file; record-level access stays with the
 * data_query / data_aggregate tools. Raw records are never embedded.
 */
export function buildDataSchemaCard(
  relativePath: string,
  info: DataSessionInfo,
  samples: DataRecord[]
): string {
  const lines = [
    `Data file: ${relativePath}`,
    `Format: ${info.kind} (${info.shape}), ${info.rowCount} records, ${humanSize(info.byteSize)}.`,
    describeColumns(info),
    describeSamples(samples),
    'Query this file with the data_schema, data_query, and data_aggregate tools instead of reading it.'
  ]
  return lines.filter(Boolean).join('\n')
}
