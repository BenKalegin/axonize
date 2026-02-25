import type { LLMMessage, LLMResponse } from './types'

export abstract class LLMProvider {
  abstract readonly providerId: string

  abstract complete(messages: LLMMessage[]): Promise<LLMResponse>
}
