import type { Agent } from './agent'
import type { AgentConfig } from '../../core/rag/types'
import { AgentProvider, AgentTransport } from '../../core/rag/types'
import { ClaudeCodeNpmAgent } from './claude-code-npm-agent'
import { ClaudeCodeTtyAgent } from './claude-code-tty-agent'
import { KiroCliAgent } from './kiro-cli-agent'

export function createAgent(config: AgentConfig): Agent {
  if (config.provider === AgentProvider.Kiro) {
    return new KiroCliAgent({
      model: config.model,
      kiroCliPath: config.kiroCliPath ?? ''
    })
  }
  if (config.transport === AgentTransport.Tty) {
    return new ClaudeCodeTtyAgent({
      model: config.model,
      claudeCliPath: config.claudeCliPath ?? ''
    })
  }
  return new ClaudeCodeNpmAgent({ model: config.model })
}
