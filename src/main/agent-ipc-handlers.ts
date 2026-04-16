import { ipcMain } from 'electron'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import { llmContentToString, type LLMContent, type LLMContentBlock, type LLMMessage } from '../core/rag/types'
import { AGENT_TOOLS, executeTools, type ToolUseBlock } from './agent-tools/tools'
import { getVaultContext } from './agent-tools/vault-context'
import log from './logger'

/**
 * Enhanced agent IPC handlers with tool support
 * Based on Claude Code's tool architecture
 */

interface AgentHistoryMessage {
  role: 'user' | 'assistant'
  content: LLMContent
}

interface AgentChatPayload {
  prompt: string
  context?: string
  history?: AgentHistoryMessage[]
  vaultPath?: string
  sessionId?: string
}

type ContentBlock = LLMContentBlock

const MAX_CONTEXT_CHARS = 12000
const MAX_HISTORY_MESSAGES = 10
const MAX_TOOL_ITERATIONS = 5 // Prevent infinite loops

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n...[truncated]`
}

function normalizeHistory(history: AgentHistoryMessage[] | undefined): AgentHistoryMessage[] {
  if (!Array.isArray(history)) {
    return []
  }
  return history
    .filter(
      (message) =>
        (message.role === 'user' || message.role === 'assistant') &&
        (typeof message.content === 'string' || Array.isArray(message.content))
    )
    .slice(-MAX_HISTORY_MESSAGES)
}

/**
 * Convert content blocks to string for simple display
 */
function contentBlocksToString(blocks: ContentBlock[]): string {
  return llmContentToString(blocks)
}

export function toProviderContent(content: LLMContent, preserveStructuredContent: boolean): LLMContent {
  if (typeof content === 'string' || preserveStructuredContent) {
    return content
  }
  return llmContentToString(content)
}

/**
 * Extract tool use blocks from content
 */
function extractToolUses(content: ContentBlock[]): ToolUseBlock[] {
  return content.filter((block) => block.type === 'tool_use') as ToolUseBlock[]
}

export function normalizeAgentAnswer(answer: string): string {
  const trimmed = answer.trim()
  if (trimmed.length > 0) {
    return trimmed
  }

  return 'The agent returned an empty response. Try again, or switch to a different LLM provider in settings.'
}

/**
 * Main chat handler with tool support
 */
async function chatWithTools(
  payload: AgentChatPayload,
  iteration = 0
): Promise<{ answer: string; model: string; usage?: { inputTokens: number; outputTokens: number } }> {
  if (iteration >= MAX_TOOL_ITERATIONS) {
    throw new Error('Maximum tool iterations exceeded. The agent may be stuck in a loop.')
  }

  const sessionId = payload.sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const prompt = String(payload.prompt ?? '').trim()
  if (!prompt && iteration === 0) {
    throw new Error('Prompt is required')
  }

  const context = String(payload.context ?? '').trim()
  const normalizedHistory = normalizeHistory(payload.history)

  const settings = await getSettings()
  const llm = getLLMProvider(settings.llm)

  const toolsEnabled = llm.supportsTools()

  const messages: LLMMessage[] = []

  // System prompt (only on first iteration)
  if (iteration === 0) {
    messages.push({
      role: 'system',
      content:
        'You are Axonize Agent, an intelligent assistant for exploring and analyzing documentation vaults. ' +
        (toolsEnabled
          ? 'You have access to tools for finding and reading files. Use them proactively to answer questions accurately. ' +
            'Always search for relevant files before making claims about vault contents.'
          : 'You can help users understand their documentation. ') +
        'Be concise, accurate, and helpful.'
    })
  }

  // Vault context (only on first iteration)
  if (iteration === 0 && payload.vaultPath) {
    const vaultCtx = await getVaultContext(payload.vaultPath)
    messages.push({
      role: 'user',
      content: vaultCtx
    })
  }

  // Session context (only on first iteration)
  if (iteration === 0 && context) {
    messages.push({
      role: 'user',
      content: `Session context:\n${truncate(context, MAX_CONTEXT_CHARS)}`
    })
  }

  // History
  for (const historyMessage of normalizedHistory) {
    messages.push({
      role: historyMessage.role,
      content: toProviderContent(historyMessage.content, toolsEnabled)
    })
  }

  // Current prompt (only on first iteration)
  if (iteration === 0) {
    messages.push({ role: 'user', content: prompt })
  }

  try {
    // Call LLM with tools if supported
    const response = await llm.complete(messages, toolsEnabled ? AGENT_TOOLS : undefined)

    // Check if response contains tool uses
    const content = response.content
    let contentBlocks: ContentBlock[]

    if (typeof content === 'string') {
      contentBlocks = [{ type: 'text', text: content }]
    } else if (Array.isArray(content)) {
      contentBlocks = content as ContentBlock[]
    } else {
      contentBlocks = [{ type: 'text', text: String(content) }]
    }

    const toolUses = extractToolUses(contentBlocks)

    // If no tool uses, we're done
    if (toolUses.length === 0) {
      return {
        answer: normalizeAgentAnswer(contentBlocksToString(contentBlocks)),
        model: response.model,
        usage: response.usage
      }
    }

    // Execute tools
    log.info(`Executing ${toolUses.length} tool(s)`)
    const toolResults = await executeTools(
      toolUses,
      payload.vaultPath || process.cwd(),
      sessionId
    )

    // Continue conversation with tool results
    const updatedHistory: AgentHistoryMessage[] = [
      ...normalizedHistory,
      { role: 'assistant', content: contentBlocks },
      { role: 'user', content: toolResults }
    ]

    return chatWithTools(
      {
        ...payload,
        sessionId,
        prompt: '', // Empty prompt for continuation
        history: updatedHistory
      },
      iteration + 1
    )
  } catch (error) {
    log.error('agent:chat failed:', error)
    throw error
  }
}

/**
 * Register enhanced agent IPC handlers
 */
export function registerAgentIpcHandlers(): void {
  ipcMain.handle('agent:chat', async (_event, payload: AgentChatPayload) => {
    // Generate session ID if not provided
    if (!payload.sessionId) {
      payload.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }

    return chatWithTools(payload)
  })
}
