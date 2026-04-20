import type { Agent } from './agent'
import type { AgentConfig } from '../../core/rag/types'
import { AgentTransport } from '../../core/rag/types'
import { ClaudeCodeNpmAgent } from './claude-code-npm-agent'
import { ClaudeCodeTtyAgent } from './claude-code-tty-agent'

export function createAgent(config: AgentConfig): Agent {
  if (config.transport === AgentTransport.Tty) {
    return new ClaudeCodeTtyAgent({
      model: config.model,
      claudeCliPath: config.claudeCliPath ?? ''
    })
  }
  return new ClaudeCodeNpmAgent({ model: config.model })
}
