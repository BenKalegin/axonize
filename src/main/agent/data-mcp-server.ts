import { isAbsolute, join, relative, resolve } from 'path'
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import type { DataRecord } from '../../core/data/types'
import { DataShape } from '../../core/data/types'
import { FilterOp, type FieldFilter } from '../../core/data/row-query'
import { AggregateOp } from '../../core/data/aggregate'
import { dataFileKindOf } from '../../core/vault/data-file-types'
import {
  aggregateDataFile,
  getRows,
  openDataFile,
  queryDataFile
} from '../data/data-file-service'
import log from '../logger'

const DATA_SERVER_NAME = 'axonize-data'
const SCHEMA_TOOL_NAME = 'data_schema'
const QUERY_TOOL_NAME = 'data_query'
const AGGREGATE_TOOL_NAME = 'data_aggregate'

/** Hard caps so a careless query can never flood the agent's context window. */
const MAX_AGENT_RESULT_ROWS = 50
const DEFAULT_AGENT_RESULT_ROWS = 20
const MAX_AGENT_CELL_CHARS = 200

const FILTER_OPS = Object.values(FilterOp) as [FilterOp, ...FilterOp[]]
const AGGREGATE_OPS = Object.values(AggregateOp) as [AggregateOp, ...AggregateOp[]]

const PATH_DESCRIPTION = 'Vault-relative path to a .csv, .json, or .jsonl file'
const FILTERS_DESCRIPTION =
  'AND-combined predicates over record fields. Ops: eq/neq (strict), contains (case-insensitive substring), gt/lt (same-type number or string compare), exists'

export async function createInProcessDataMcpServer(
  vaultPath: string
): Promise<McpSdkServerConfigWithInstance> {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const { z } = await import('zod')

  const filterSchema = z.array(
    z.object({
      field: z.string(),
      op: z.enum(FILTER_OPS),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
    })
  )

  const schemaTool = tool(
    SCHEMA_TOOL_NAME,
    'Inspect the structure of a data file (.csv/.json/.jsonl) in the vault: row count, columns with inferred types, and an example record. Call this before data_query or data_aggregate to learn the field names.',
    { path: z.string().describe(PATH_DESCRIPTION) },
    async ({ path }) => run(SCHEMA_TOOL_NAME, () => describeSchema(vaultPath, path))
  )

  const queryTool = tool(
    QUERY_TOOL_NAME,
    'Filter and project records of a data file in the vault. Returns matching records as JSONL plus the total match count. Use instead of Read for data files — it never floods the context.',
    {
      path: z.string().describe(PATH_DESCRIPTION),
      filters: filterSchema.optional().describe(FILTERS_DESCRIPTION),
      select: z.array(z.string()).optional().describe('Fields to keep in returned records'),
      offset: z.number().int().min(0).optional().describe('Matches to skip (default 0)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_AGENT_RESULT_ROWS)
        .optional()
        .describe(`Max records to return (default ${DEFAULT_AGENT_RESULT_ROWS}, cap ${MAX_AGENT_RESULT_ROWS})`)
    },
    async ({ path, filters, select, offset, limit }) =>
      run(QUERY_TOOL_NAME, () =>
        describeQuery(vaultPath, path, filters ?? [], select, offset ?? 0, limit ?? DEFAULT_AGENT_RESULT_ROWS)
      )
  )

  const aggregateTool = tool(
    AGGREGATE_TOOL_NAME,
    'Aggregate records of a data file in the vault: count, or min/max/sum of a numeric field, optionally grouped by a field and pre-filtered. Prefer this over fetching rows when the question is a statistic.',
    {
      path: z.string().describe(PATH_DESCRIPTION),
      op: z.enum(AGGREGATE_OPS),
      field: z.string().optional().describe('Numeric field to aggregate (required for min/max/sum)'),
      groupBy: z.string().optional().describe('Field to group results by'),
      filters: filterSchema.optional().describe(FILTERS_DESCRIPTION)
    },
    async ({ path, op, field, groupBy, filters }) =>
      run(AGGREGATE_TOOL_NAME, () => describeAggregate(vaultPath, path, op, field, groupBy, filters ?? []))
  )

  return createSdkMcpServer({
    name: DATA_SERVER_NAME,
    tools: [schemaTool, queryTool, aggregateTool]
  })
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

async function run(toolName: string, produce: () => Promise<string>): Promise<ToolResult> {
  try {
    return { content: [{ type: 'text' as const, text: await produce() }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`data-mcp: ${toolName} failed:`, error)
    return { content: [{ type: 'text' as const, text: `${toolName} error: ${message}` }], isError: true }
  }
}

/** Resolve a vault-relative path, rejecting escapes and non-data files. */
function resolveDataPath(vaultPath: string, relPath: string): string {
  if (!dataFileKindOf(relPath)) {
    throw new Error(`${relPath} is not a data file (.csv/.json/.jsonl)`)
  }
  const full = resolve(join(vaultPath, relPath))
  const rel = relative(resolve(vaultPath), full)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`path escapes the vault: ${relPath}`)
  }
  return full
}

async function describeSchema(vaultPath: string, relPath: string): Promise<string> {
  const fullPath = resolveDataPath(vaultPath, relPath)
  const info = await openDataFile(fullPath)
  const lines = [
    `${relPath} — ${info.kind}, ${info.shape}, ${info.rowCount} rows, ${info.byteSize} bytes`
  ]

  if (info.shape === DataShape.Tree) {
    lines.push(
      'Tree-shaped JSON (root is an object): row queries are unavailable; use Read for small files or search in the viewer.'
    )
    return lines.join('\n')
  }

  lines.push('columns:')
  for (const col of info.schema.columns) {
    const example = col.example !== undefined ? ` (e.g. ${col.example})` : ''
    lines.push(`  - ${col.name}: ${col.type}${example}`)
  }

  const [firstRow] = await getRows(fullPath, 0, 1)
  if (firstRow && !firstRow.error) {
    lines.push('example record:', stringifyRecordCapped(firstRow.record))
  }
  return lines.join('\n')
}

async function describeQuery(
  vaultPath: string,
  relPath: string,
  filters: FieldFilter[],
  select: string[] | undefined,
  offset: number,
  limit: number
): Promise<string> {
  const fullPath = resolveDataPath(vaultPath, relPath)
  const result = await queryDataFile(fullPath, filters, select, offset, limit)
  const shown = result.rows.length
  const header = `${result.totalMatches} matching records (showing ${shown ? `${offset}..${offset + shown - 1}` : 'none'})`
  const body = result.rows.map((row) => stringifyRecordCapped(row.record))
  return [header, ...body].join('\n')
}

async function describeAggregate(
  vaultPath: string,
  relPath: string,
  op: AggregateOp,
  field: string | undefined,
  groupBy: string | undefined,
  filters: FieldFilter[]
): Promise<string> {
  if (op !== AggregateOp.Count && field === undefined) {
    throw new Error(`op "${op}" requires a numeric "field"`)
  }
  const fullPath = resolveDataPath(vaultPath, relPath)
  const result = await aggregateDataFile(fullPath, op, field, groupBy, filters)

  const what = op === AggregateOp.Count ? 'count' : `${op}(${field})`
  const by = groupBy ? ` by ${groupBy}` : ''
  const lines = [`${what}${by} — ${result.groups.length} group(s)${result.truncated ? ' (group cap hit; some groups dropped)' : ''}`]
  for (const group of result.groups) {
    const records = op === AggregateOp.Count ? '' : ` (${group.recordCount} records)`
    lines.push(`  ${group.key}: ${group.value ?? 'n/a'}${records}`)
  }
  return lines.join('\n')
}

/** Cap every field so one wide record cannot flood the agent's context. */
function stringifyRecordCapped(record: DataRecord): string {
  const capped: DataRecord = {}
  for (const [key, value] of Object.entries(record)) {
    capped[key] = capValue(value)
  }
  return JSON.stringify(capped)
}

function capValue(value: unknown): unknown {
  if (typeof value === 'string') return truncate(value)
  if (typeof value === 'object' && value !== null) {
    const text = JSON.stringify(value) ?? ''
    return text.length > MAX_AGENT_CELL_CHARS ? truncate(text) : value
  }
  return value
}

function truncate(text: string): string {
  return text.length > MAX_AGENT_CELL_CHARS ? `${text.slice(0, MAX_AGENT_CELL_CHARS)}…` : text
}

export const DATA_MCP_SERVER_NAME = DATA_SERVER_NAME
export const DATA_MCP_TOOL_NAMES = [SCHEMA_TOOL_NAME, QUERY_TOOL_NAME, AGGREGATE_TOOL_NAME] as const
