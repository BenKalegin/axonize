export const AgentEventKind = {
  Session: 'session',
  TextDelta: 'text_delta',
  ToolUse: 'tool_use',
  ToolResult: 'tool_result',
  Done: 'done',
  Error: 'error',
  Closed: 'closed'
} as const

export type AgentEventKind = (typeof AgentEventKind)[keyof typeof AgentEventKind]
