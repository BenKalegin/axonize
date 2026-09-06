import { LLMProvider, type ToolDefinition } from './llm-provider'
import { llmContentToString, type LLMConfig, type LLMMessage, type LLMResponse } from './types'

const CODEX_PROMPT_GUARDRAILS = [
  'You are answering inside Axonize as a text-only assistant.',
  'Respond only to the prompt content provided below.',
  'Do not make file changes, run commands, browse the web, or ask for approvals.',
  'Return only the requested answer.'
].join(' ')

export class CodexProvider extends LLMProvider {
  readonly providerId = 'codex'
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    super()
    this.config = config
  }

  supportsTools(): boolean {
    return false
  }

  async complete(messages: LLMMessage[], _tools?: ToolDefinition[]): Promise<LLMResponse> {
    const { Codex } = await import('@openai/codex-sdk')

    const codex = new Codex()
    const thread = codex.startThread({
      model: this.config.model || undefined,
      approvalPolicy: 'never',
      sandboxMode: 'read-only',
      networkAccessEnabled: false,
      webSearchEnabled: false,
      skipGitRepoCheck: true
    })

    const turn = await thread.run(formatPrompt(messages))

    return {
      content: turn.finalResponse,
      model: this.config.model || 'codex',
      usage: {
        inputTokens: turn.usage?.input_tokens ?? 0,
        outputTokens: turn.usage?.output_tokens ?? 0
      }
    }
  }
}

function formatPrompt(messages: LLMMessage[]): string {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => llmContentToString(message.content).trim())
    .filter(Boolean)

  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${roleLabel(message.role)}:\n${llmContentToString(message.content)}`)
    .join('\n\n')

  return [
    CODEX_PROMPT_GUARDRAILS,
    systemMessages.length > 0 ? `System instructions:\n${systemMessages.join('\n\n')}` : '',
    conversation ? `Conversation:\n${conversation}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')
}

function roleLabel(role: LLMMessage['role']): string {
  switch (role) {
    case 'assistant':
      return 'Assistant'
    case 'user':
      return 'User'
    default:
      return 'System'
  }
}
