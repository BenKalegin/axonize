import type { AgentEvent } from './agent'
import { AgentEventType } from './agent'

export function extractSessionId(message: unknown): string | null {
  if (!isRecord(message)) return null
  return typeof message.session_id === 'string' ? message.session_id : null
}

export function translateSdkMessage(message: unknown): AgentEvent[] {
  if (!isRecord(message)) return []

  if (message.type === 'stream_event') {
    const delta = extractTextDelta(message.event)
    return delta ? [delta] : []
  }
  if (message.type === 'assistant') {
    const toolUse = extractToolUse(message)
    return toolUse ? [toolUse] : []
  }
  if (message.type === 'user') {
    const toolResult = extractToolResult(message)
    return toolResult ? [toolResult] : []
  }
  if (message.type === 'result') {
    return [buildDoneOrError(message)]
  }
  return []
}

function extractTextDelta(rawEvent: unknown): AgentEvent | null {
  if (!isRecord(rawEvent)) return null
  if (rawEvent.type !== 'content_block_delta') return null
  const delta = rawEvent.delta
  if (!isRecord(delta)) return null
  if (delta.type !== 'text_delta') return null
  if (typeof delta.text !== 'string' || !delta.text) return null
  return { type: AgentEventType.TextDelta, text: delta.text }
}

function extractToolUse(message: Record<string, unknown>): AgentEvent | null {
  const msg = message.message
  if (!isRecord(msg)) return null
  const content = msg.content
  if (!Array.isArray(content)) return null
  const firstToolUse = content.find((block) => isRecord(block) && block.type === 'tool_use') as
    | { name?: unknown; input?: unknown }
    | undefined
  if (!firstToolUse) return null
  return {
    type: AgentEventType.ToolUse,
    toolName: typeof firstToolUse.name === 'string' ? firstToolUse.name : 'unknown',
    input: firstToolUse.input
  }
}

function extractToolResult(message: Record<string, unknown>): AgentEvent | null {
  const msg = message.message
  if (!isRecord(msg)) return null
  const content = msg.content
  if (!Array.isArray(content)) return null
  const firstToolResult = content.find((block) => isRecord(block) && block.type === 'tool_result') as
    | { content?: unknown; is_error?: boolean }
    | undefined
  if (!firstToolResult) return null
  return {
    type: AgentEventType.ToolResult,
    toolName: '',
    result: toolResultToString(firstToolResult.content),
    isError: firstToolResult.is_error === true
  }
}

function buildDoneOrError(message: Record<string, unknown>): AgentEvent {
  const usage = isRecord(message.usage) ? message.usage : undefined
  const totalCostUsd = typeof message.total_cost_usd === 'number' ? message.total_cost_usd : undefined

  if (message.subtype === 'success') {
    return {
      type: AgentEventType.Done,
      totalCostUsd,
      inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined,
      outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined
    }
  }

  const errorText = Array.isArray(message.errors) && message.errors.length > 0
    ? message.errors.join('; ')
    : String(message.subtype ?? 'unknown error')
  return { type: AgentEventType.Error, error: errorText }
}

function toolResultToString(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => (isRecord(block) && typeof block.text === 'string' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
