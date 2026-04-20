export interface AgentStartParams {
  prompt: string
  vaultPath: string
  allowEdits: boolean
  claudeSessionId?: string
  systemPrompt?: string
  abortSignal: AbortSignal
}

export const AgentEventType = {
  Session: 'session',
  TextDelta: 'text_delta',
  ToolUse: 'tool_use',
  ToolResult: 'tool_result',
  Done: 'done',
  Error: 'error'
} as const
export type AgentEventType = (typeof AgentEventType)[keyof typeof AgentEventType]

export type AgentEvent =
  | { type: typeof AgentEventType.Session; claudeSessionId: string }
  | { type: typeof AgentEventType.TextDelta; text: string }
  | { type: typeof AgentEventType.ToolUse; toolName: string; input: unknown }
  | { type: typeof AgentEventType.ToolResult; toolName: string; result: string; isError?: boolean }
  | { type: typeof AgentEventType.Done; totalCostUsd?: number; inputTokens?: number; outputTokens?: number }
  | { type: typeof AgentEventType.Error; error: string }

export interface Agent {
  run(params: AgentStartParams): AsyncIterable<AgentEvent>
}

export const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'LS'] as const
export const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash'] as const
