import { readFile, stat } from 'fs/promises'
import { isAbsolute, relative, resolve, sep } from 'path'
import { globFiles, grepContent } from './file-search'
import { sessionCacheManager } from './file-cache'
import type { LLMToolResultBlock, LLMToolUseBlock } from '../../core/rag/types'
import log from '../logger'

/**
 * Agent tool definitions and implementations
 * Based on Claude Code's tool architecture
 */

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export type ToolUseBlock = LLMToolUseBlock
export type ToolResultBlock = LLMToolResultBlock

/**
 * Tool definitions for agent
 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'glob',
    description:
      'Find files matching a glob pattern in the vault. ' +
      'Use patterns like "**/*.md" for all markdown files, ' +
      '"docs/**/*.json" for JSON files in docs folder, ' +
      'or "**/eval*.md" to find files containing "eval" in name.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.md", "docs/**/*.json")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of files to return (default: 100)',
          default: 100
        },
        offset: {
          type: 'number',
          description: 'Number of files to skip (for pagination)',
          default: 0
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'grep',
    description:
      'Search file contents using regex patterns. ' +
      'Returns matching lines with file paths and line numbers. ' +
      'Use output_mode to control result format: ' +
      '"files_with_matches" (just paths), "content" (full matches), or "count" (match counts).',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for'
        },
        glob: {
          type: 'string',
          description: 'File filter pattern (e.g., "*.md")'
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Ignore case when matching',
          default: false
        },
        output_mode: {
          type: 'string',
          description: 'Output format',
          enum: ['content', 'files_with_matches', 'count'],
          default: 'files_with_matches'
        },
        max_count: {
          type: 'number',
          description: 'Maximum matches per file',
          default: 50
        },
        context_lines: {
          type: 'number',
          description: 'Number of context lines around each match',
          default: 0
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'read_file',
    description:
      'Read a file from the vault. ' +
      'Returns file content with line numbers in cat -n format. ' +
      'Can optionally read a specific line range for large files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path from vault root'
        },
        line_start: {
          type: 'number',
          description: 'Optional: first line to read (1-indexed)'
        },
        line_end: {
          type: 'number',
          description: 'Optional: last line to read (1-indexed)'
        }
      },
      required: ['path']
    }
  }
]

/**
 * Format file content with line numbers (cat -n style)
 */
function formatWithLineNumbers(content: string, startLine = 1): string {
  const lines = content.split('\n')
  const maxLineNum = startLine + lines.length - 1
  const padding = maxLineNum.toString().length

  return lines
    .map((line, i) => {
      const lineNum = startLine + i
      return `${lineNum.toString().padStart(padding, ' ')}→${line}`
    })
    .join('\n')
}

/**
 * Read file with optional line range
 */
async function readFileWithRange(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')

  if (lineStart !== undefined) {
    const start = Math.max(0, lineStart - 1) // Convert to 0-indexed
    const end = lineEnd ? Math.min(lines.length, lineEnd) : Math.min(lines.length, start + 100)
    const selectedLines = lines.slice(start, end)
    return formatWithLineNumbers(selectedLines.join('\n'), lineStart)
  }

  return formatWithLineNumbers(content)
}

/**
 * Execute glob tool
 */
async function executeGlobTool(
  input: { pattern: string; limit?: number; offset?: number },
  vaultPath: string
): Promise<string> {
  const { files, truncated } = await globFiles(input.pattern, vaultPath, {
    limit: input.limit || 100,
    offset: input.offset || 0
  })

  if (files.length === 0) {
    return `No files found matching pattern: ${input.pattern}`
  }

  let result = `Found ${files.length} file(s)${truncated ? ' (truncated)' : ''}:\n\n`
  result += files.map((f) => `- ${f}`).join('\n')

  if (truncated) {
    result += `\n\n(More results available - use offset parameter to see more)`
  }

  return result
}

/**
 * Execute grep tool
 */
async function executeGrepTool(
  input: {
    pattern: string
    glob?: string
    case_insensitive?: boolean
    output_mode?: 'content' | 'files_with_matches' | 'count'
    max_count?: number
    context_lines?: number
  },
  vaultPath: string
): Promise<string> {
  const { matches } = await grepContent(input.pattern, vaultPath, {
    glob: input.glob,
    caseInsensitive: input.case_insensitive || false,
    outputMode: input.output_mode || 'files_with_matches',
    maxCount: input.max_count || 50,
    contextBefore: input.context_lines,
    contextAfter: input.context_lines
  })

  if (matches.length === 0) {
    return `No matches found for pattern: ${input.pattern}`
  }

  const mode = input.output_mode || 'files_with_matches'

  if (mode === 'files_with_matches') {
    let result = `Found matches in ${matches.length} file(s):\n\n`
    result += matches.map((m) => `- ${m.file}`).join('\n')
    return result
  } else if (mode === 'count') {
    let result = `Match counts:\n\n`
    result += matches.map((m) => `- ${m.file}: ${m.count} matches`).join('\n')
    return result
  } else {
    // content mode
    let result = `Found ${matches.length} match(es):\n\n`
    for (const match of matches) {
      result += `${match.file}:${match.lineNumber}\n`
      result += `  ${match.line}\n\n`
    }
    return result
  }
}

/**
 * Execute read_file tool
 */
async function executeReadFileTool(
  input: { path: string; line_start?: number; line_end?: number },
  vaultPath: string,
  sessionId: string
): Promise<string> {
  const normalizedVaultPath = resolve(vaultPath)
  const fullPath = resolve(normalizedVaultPath, input.path)
  const relativePath = relative(normalizedVaultPath, fullPath)

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Path must stay within the vault root: ${input.path}`)
  }

  // Check cache first
  const cache = sessionCacheManager.getCache(sessionId)
  const cached = await cache.get(fullPath)

  if (cached && !input.line_start) {
    // Cache hit for full file read
    return formatWithLineNumbers(cached)
  }

  // Read from disk
  try {
    const stats = await stat(fullPath)
    const content = await readFileWithRange(fullPath, input.line_start, input.line_end)

    // Cache full file reads only
    if (!input.line_start && stats.size < 1024 * 1024) {
      // Cache files < 1MB
      const rawContent = await readFile(fullPath, 'utf-8')
      cache.set(fullPath, rawContent, stats.mtimeMs, stats.size)
    }

    return content
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${input.path}`)
    }
    throw error
  }
}

/**
 * Execute a single tool
 */
export async function executeTool(
  toolUse: ToolUseBlock,
  vaultPath: string,
  sessionId: string
): Promise<ToolResultBlock> {
  try {
    let result: string

    switch (toolUse.name) {
      case 'glob':
        result = await executeGlobTool(
          toolUse.input as { pattern: string; limit?: number; offset?: number },
          vaultPath
        )
        break

      case 'grep':
        result = await executeGrepTool(
          toolUse.input as {
            pattern: string
            glob?: string
            case_insensitive?: boolean
            output_mode?: 'content' | 'files_with_matches' | 'count'
            max_count?: number
            context_lines?: number
          },
          vaultPath
        )
        break

      case 'read_file':
        result = await executeReadFileTool(
          toolUse.input as { path: string; line_start?: number; line_end?: number },
          vaultPath,
          sessionId
        )
        break

      default:
        throw new Error(`Unknown tool: ${toolUse.name}`)
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: result
    }
  } catch (error) {
    log.error(`Tool execution failed for ${toolUse.name}:`, error)
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: error instanceof Error ? error.message : String(error),
      is_error: true
    }
  }
}

/**
 * Execute multiple tools in parallel
 */
export async function executeTools(
  toolUses: ToolUseBlock[],
  vaultPath: string,
  sessionId: string
): Promise<ToolResultBlock[]> {
  return Promise.all(toolUses.map((toolUse) => executeTool(toolUse, vaultPath, sessionId)))
}
