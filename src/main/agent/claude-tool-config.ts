import { READ_ONLY_TOOLS, WRITE_TOOLS } from './agent'
import { RAG_MCP_SERVER_NAME, RAG_MCP_TOOL_NAME } from './rag-mcp-server'
import { DIAGRAM_BLOCKS_INSTRUCTION } from '../prompts/diagram-prompts'

const PRESET_TOOLS = ['Task', 'WebFetch', 'WebSearch', 'TodoWrite']
export const RAG_TOOL_ID = `mcp__${RAG_MCP_SERVER_NAME}__${RAG_MCP_TOOL_NAME}`

export function allowedTools(allowEdits: boolean): string[] {
  const base = [...READ_ONLY_TOOLS, ...PRESET_TOOLS, RAG_TOOL_ID]
  return allowEdits ? [...base, ...WRITE_TOOLS] : base
}

export function disallowedTools(allowEdits: boolean): string[] {
  return allowEdits ? [] : [...WRITE_TOOLS]
}

export function defaultSystemPrompt(): string {
  const guidance = [
    'You are Axonize Agent, an expert assistant working inside a markdown documentation vault.',
    'The current working directory is the vault root. Use Read/Glob/Grep to explore files, and rag_query (MCP tool) for semantic questions across the whole vault.',
    'When asked to edit docs, use Write/Edit — but only if the user has explicitly granted edit permission (the session allows it). If an edit tool is unavailable, stop and ask the user to enable edits.',
    'Be concise, cite file paths when referring to specific content, and prefer doing the smallest change that satisfies the request.'
  ].join(' ')
  return `${guidance}\n\n${DIAGRAM_BLOCKS_INSTRUCTION}`
}
