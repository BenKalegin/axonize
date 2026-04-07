import { ipcMain } from 'electron'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import type { LLMMessage } from '../core/rag/types'
import log from './logger'

interface AgentHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentChatPayload {
  prompt: string
  context?: string
  history?: AgentHistoryMessage[]
  vaultPath?: string
}

const MAX_CONTEXT_CHARS = 12000
const MAX_HISTORY_MESSAGES = 10

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n...[truncated]`
}

function normalizeHistory(history: AgentHistoryMessage[] | undefined): AgentHistoryMessage[] {
  if (!Array.isArray(history)) {
    return []
  }
  return history
    .filter(
      (message) =>
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
}

export function registerAgentIpcHandlers(): void {
  ipcMain.handle('agent:chat', async (_event, payload: AgentChatPayload) => {
    const prompt = String(payload.prompt ?? '').trim()
    if (!prompt) {
      throw new Error('Prompt is required')
    }

    const context = String(payload.context ?? '').trim()
    const normalizedHistory = normalizeHistory(payload.history)

    const settings = await getSettings()
    const llm = getLLMProvider(settings.llm)

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You are Axonize Agent assistant. ' +
          'You are in planning mode for now: propose safe, concrete vault operations when asked. ' +
          'Do not claim to have executed any filesystem change. ' +
          'Keep answers concise and actionable.'
      }
    ]

    if (payload.vaultPath) {
      messages.push({
        role: 'user',
        content: `Current vault root: ${payload.vaultPath}`
      })
    }

    if (context) {
      messages.push({
        role: 'user',
        content: `Session context:\n${truncate(context, MAX_CONTEXT_CHARS)}`
      })
    }

    for (const historyMessage of normalizedHistory) {
      messages.push({
        role: historyMessage.role,
        content: historyMessage.content
      })
    }

    messages.push({ role: 'user', content: prompt })

    try {
      const response = await llm.complete(messages)
      return {
        answer: response.content,
        model: response.model,
        usage: response.usage
      }
    } catch (error) {
      log.error('agent:chat failed:', error)
      throw error
    }
  })
}
