import { describe, expect, it } from 'vitest'
import { createLLMProvider } from '../../../src/core/rag/llm-factory'
import type { LLMConfig } from '../../../src/core/rag/types'

const BASE_CONFIG: Omit<LLMConfig, 'provider'> = {
  model: '',
  maxTokens: 1024,
  temperature: 0.3
}

describe('createLLMProvider', () => {
  it('creates the Codex subscription provider', () => {
    const provider = createLLMProvider({ ...BASE_CONFIG, provider: 'codex' })
    expect(provider.providerId).toBe('codex')
  })

  it('creates the Claude Code subscription provider', () => {
    const provider = createLLMProvider({ ...BASE_CONFIG, provider: 'claude-code' })
    expect(provider.providerId).toBe('claude-code')
  })
})
