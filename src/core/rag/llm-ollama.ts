import { LLMProvider } from './llm-provider'
import type { LLMConfig, LLMMessage, LLMResponse } from './types'

export class OllamaProvider extends LLMProvider {
  readonly providerId = 'ollama'
  private readonly config: LLMConfig
  private readonly baseUrl: string

  constructor(config: LLMConfig) {
    super()
    this.config = config
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434'
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Ollama API error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      message: { content: string }
      model: string
      prompt_eval_count?: number
      eval_count?: number
    }

    return {
      content: data.message?.content ?? '',
      model: data.model,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0
      }
    }
  }
}
