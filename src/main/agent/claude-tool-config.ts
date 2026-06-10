import { READ_ONLY_TOOLS, WRITE_TOOLS } from './agent'
import { RAG_MCP_SERVER_NAME, RAG_MCP_TOOL_NAME } from './rag-mcp-server'
import { DATA_MCP_SERVER_NAME, DATA_MCP_TOOL_NAMES } from './data-mcp-server'
import { DIAGRAM_BLOCKS_INSTRUCTION } from '../prompts/diagram-prompts'

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
    'When asked to edit docs, use Write/Edit — but only if the user has explicitly granted edit permission (the session allows it). If an edit tool is unavailable, stop and ask the user to enable edits.',
    'Be concise, cite file paths when referring to specific content, and prefer doing the smallest change that satisfies the request.'
  ].join(' ')
  return `${guidance}\n\n${DIAGRAM_BLOCKS_INSTRUCTION}`
}
