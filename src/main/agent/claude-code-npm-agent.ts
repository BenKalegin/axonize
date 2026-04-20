import type { Agent, AgentEvent, AgentStartParams } from './agent'
import { AgentEventType } from './agent'
import { createInProcessRagMcpServer, RAG_MCP_SERVER_NAME } from './rag-mcp-server'
import { allowedTools, defaultSystemPrompt, disallowedTools } from './claude-tool-config'
import { extractSessionId, translateSdkMessage } from './sdk-message-translator'
import log from '../logger'

interface NpmAgentDeps {
  model: string
}

export class ClaudeCodeNpmAgent implements Agent {
  constructor(private readonly deps: NpmAgentDeps) {}

  async *run(params: AgentStartParams): AsyncIterable<AgentEvent> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')
    const ragServer = await createInProcessRagMcpServer(params.vaultPath)
    const abortController = toAbortController(params.abortSignal)

    let lastSessionId: string | null = null

    try {
      for await (const message of query({
        prompt: params.prompt,
        options: {
          model: this.deps.model,
          cwd: params.vaultPath,
          resume: params.claudeSessionId,
          systemPrompt: params.systemPrompt ?? defaultSystemPrompt(),
          includePartialMessages: true,
          mcpServers: { [RAG_MCP_SERVER_NAME]: ragServer },
          allowedTools: allowedTools(params.allowEdits),
          disallowedTools: disallowedTools(params.allowEdits),
          abortController
        }
      })) {
        const sessionId = extractSessionId(message)
        if (sessionId && sessionId !== lastSessionId) {
          lastSessionId = sessionId
          yield { type: AgentEventType.Session, claudeSessionId: sessionId }
        }
        for (const event of translateSdkMessage(message)) {
          yield event
        }
      }
    } catch (error) {
      log.error('ClaudeCodeNpmAgent: run failed', error)
      yield { type: AgentEventType.Error, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

function toAbortController(signal: AbortSignal): AbortController {
  const controller = new AbortController()
  if (signal.aborted) {
    controller.abort()
  } else {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller
}
