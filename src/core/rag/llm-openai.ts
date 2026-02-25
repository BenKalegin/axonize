import { LLMProvider } from './llm-provider'
import type { LLMConfig, LLMMessage, LLMResponse } from './types'

export class OpenAIProvider extends LLMProvider {
  readonly providerId = 'openai'
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    super()
    this.config = config
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required. Set llm.apiKey in settings.json')
    }

    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      model: string
      usage: { prompt_tokens: number; completion_tokens: number }
    }

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens
      }
    }
  }
}
