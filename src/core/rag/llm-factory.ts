import { LLMProvider } from './llm-provider'
import { AnthropicProvider } from './llm-anthropic'
import { OpenAIProvider } from './llm-openai'
import { OllamaProvider } from './llm-ollama'
import type { LLMConfig } from './types'

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'openai':
      return new OpenAIProvider(config)
    case 'ollama':
      return new OllamaProvider(config)
    default:
      throw new Error(`Unknown LLM provider: ${String(config.provider)}`)
  }
}
