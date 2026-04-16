import { LLMProvider } from './llm-provider'
import { llmContentToString, type LLMConfig, type LLMMessage, type LLMResponse } from './types'

export class ClaudeCodeProvider extends LLMProvider {
  readonly providerId = 'claude-code'
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    super()
    this.config = config
  }

  supportsTools(): boolean {
    return false
  }

  async complete(messages: LLMMessage[], _tools?: any): Promise<LLMResponse> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    const systemMessage = messages.find((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')
    const prompt = userMessages.map((m) => llmContentToString(m.content)).join('\n\n')

    let resultText = ''
    let inputTokens = 0
    let outputTokens = 0

    for await (const message of query({
      prompt,
      options: {
        model: this.config.model,
        maxTurns: 1,
        systemPrompt: systemMessage ? llmContentToString(systemMessage.content) : '',
        allowedTools: [],
      },
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        resultText = message.result
        inputTokens = message.usage?.input_tokens ?? 0
        outputTokens = message.usage?.output_tokens ?? 0
      }
    }

    return {
      content: resultText,
      model: this.config.model,
      usage: { inputTokens, outputTokens }
    }
  }
}
