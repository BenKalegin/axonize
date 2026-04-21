import type { AgentTurnRole } from './turn-kinds'

export interface AgentTurnFrontmatter {
  sessionId: string
  turnId: string
  role: AgentTurnRole
  createdAt: string
  prompt: string
  toolTrace?: string[]
}

export interface AgentTurnMeta extends AgentTurnFrontmatter {
  filePath: string
}

export interface SaveAgentTurnPayload {
  sessionId: string
  turnId: string
  role: AgentTurnRole
  prompt: string
  answer: string
  toolTrace?: string[]
}
