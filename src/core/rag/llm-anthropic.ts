import { LLMProvider } from './llm-provider'
import type { LLMConfig, LLMMessage, LLMResponse } from './types'

export class AnthropicProvider extends LLMProvider {
  readonly providerId = 'anthropic'
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    super()
    this.config = config
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required. Set llm.apiKey in settings.json')
    }

    const systemMessage = messages.find((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content }))
    }

    if (systemMessage) {
      body.system = systemMessage.content
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>
      model: string
      usage: { input_tokens: number; output_tokens: number }
    }

    const content = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return {
      content,
      model: data.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      }
    }
  }
}
