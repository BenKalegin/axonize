import { READ_ONLY_TOOLS, WRITE_TOOLS } from './agent'
import { RAG_MCP_SERVER_NAME, RAG_MCP_TOOL_NAME } from './rag-mcp-server'
import { DATA_MCP_SERVER_NAME, DATA_MCP_TOOL_NAMES } from './data-mcp-server'
import { DIAGRAM_BLOCKS_INSTRUCTION } from '../prompts/diagram-prompts'
import { HTML_ISLAND_INSTRUCTION } from '../prompts/html-island-prompts'

const PRESET_TOOLS = ['Task', 'WebFetch', 'WebSearch', 'TodoWrite']
export const RAG_TOOL_ID = `mcp__${RAG_MCP_SERVER_NAME}__${RAG_MCP_TOOL_NAME}`
export const DATA_TOOL_IDS = DATA_MCP_TOOL_NAMES.map(
  (name) => `mcp__${DATA_MCP_SERVER_NAME}__${name}`
)

export function allowedTools(allowEdits: boolean): string[] {
  const base = [...READ_ONLY_TOOLS, ...PRESET_TOOLS, RAG_TOOL_ID, ...DATA_TOOL_IDS]
  return allowEdits ? [...base, ...WRITE_TOOLS] : base
}

export function disallowedTools(allowEdits: boolean): string[] {
  return allowEdits ? [] : [...WRITE_TOOLS]
}

export function defaultSystemPrompt(): string {
  const guidance = [
    'You are Axonize Agent, an expert assistant working inside a markdown documentation vault.',
    'The current working directory is the vault root. Use Read/Glob/Grep to explore files, and rag_query (MCP tool) for semantic questions across the whole vault.',
    'The vault may also contain data files (.csv/.json/.jsonl). Use data_schema (MCP tool) to inspect their structure, and data_query / data_aggregate to filter, project, and aggregate records — do not Read large data files directly; Grep is fine for quick text matches.',
    'rag_query results may include data-file schema cards (path, columns, row count) — when one matches the question, switch to data_query / data_aggregate on that file for record-level answers.',
    'When asked to edit docs, use Write/Edit — but only if the user has explicitly granted edit permission (the session allows it). If an edit tool is unavailable, stop and ask the user to enable edits.',
    'For mathematical notation in markdown, use $...$ for inline LaTeX and $$...$$ for display equations. Never wrap equations in backticks; backticks are for literal code. When repairing converted papers, normalize artifacts such as escaped math underscores (d\\_i -> d_i) and command-subscript asterisks (\\prod*{...} -> \\prod_{...}) inside math.',
    'Be concise and prefer doing the smallest change that satisfies the request. When referring to specific vault files, cite them as markdown links with the vault-relative path as both text and target, e.g. [eval/plan.md](eval/plan.md), so they are clickable.'
  ].join(' ')
  return `${guidance}\n\n${DIAGRAM_BLOCKS_INSTRUCTION}\n\n${HTML_ISLAND_INSTRUCTION}`
}
