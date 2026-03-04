import { getSettings } from '../settings-service'
import { createLLMProvider } from '../../core/rag/llm-factory'
import type { LLMMessage } from '../../core/rag/types'
import log from '../logger'

const SEMANTIC_MAX_TOKENS = 4096
const RETRY_DELAYS = [3000, 6000, 12000]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function llmCompleteWithRetry(messages: LLMMessage[]): Promise<string> {
  const settings = await getSettings()
  const llm = createLLMProvider({ ...settings.llm, maxTokens: SEMANTIC_MAX_TOKENS })

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await llm.complete(messages)
      return response.content
    } catch (err) {
      const isRateLimit = String(err).includes('429') || String(err).includes('rate_limit')
      if (!isRateLimit || attempt >= RETRY_DELAYS.length) throw err
      const waitMs = RETRY_DELAYS[attempt]
      log.info(`[semantic] Rate limited, retrying in ${waitMs}ms...`)
      await delay(waitMs)
    }
  }
  throw new Error('Unreachable')
}

export function sanitizeJSON(raw: string): string {
  let s = raw.replace(/^```json?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
  s = s.replace(/,\s*([}\]])/g, '$1')
  return s
}

export function tryParseJSON(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
