export const AgentTurnKind = {
  Plain: 'plain',
  Analytical: 'analytical'
} as const

export type AgentTurnKind = (typeof AgentTurnKind)[keyof typeof AgentTurnKind]

export const AgentTurnRole = {
  User: 'user',
  Assistant: 'assistant'
} as const

export type AgentTurnRole = (typeof AgentTurnRole)[keyof typeof AgentTurnRole]
