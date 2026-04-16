import type { LLMMessage, LLMResponse } from './types'

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export abstract class LLMProvider {
  abstract readonly providerId: string

  abstract complete(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>

  abstract supportsTools(): boolean
}
