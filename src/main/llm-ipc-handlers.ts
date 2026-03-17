import { ipcMain } from 'electron'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import type { LLMMessage } from '../core/rag/types'
import log from './logger'

export function registerLLMIpcHandlers(): void {
  ipcMain.handle(
    'llm:rewriteSection',
    async (_event, payload: { section: string; instruction: string }) => {
      const { section, instruction } = payload

      const settings = await getSettings()
      const llm = getLLMProvider(settings.llm)

      const messages: LLMMessage[] = [
        {
          role: 'system',
          content:
            'You are a markdown editor assistant. ' +
            'Rewrite the given markdown section according to the user instruction. ' +
            'Return ONLY the rewritten markdown. No explanation, no wrapping.'
        },
        {
          role: 'user',
          content: `Instruction: ${instruction}\n\nSection:\n${section}`
        }
      ]

      try {
        const response = await llm.complete(messages)
        return response.content
      } catch (e) {
        log.error('llm:rewriteSection failed:', e)
        throw e
      }
    }
  )
}
