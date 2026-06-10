import { ipcMain } from 'electron'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import { llmContentToString, type LLMMessage } from '../core/rag/types'
import log from './logger'
import { DIAGRAM_BLOCKS_INSTRUCTION } from './prompts/diagram-prompts'

const SESSION_TITLE_MODEL = 'claude-haiku-4-5-20251001'
const SESSION_TITLE_MAX_TOKENS = 60
const SESSION_TITLE_TEMPERATURE = 0.3
const SESSION_TITLE_MAX_CHARS = 60
const ASSISTANT_PREVIEW_MAX_CHARS = 600

const SESSION_TITLE_SYSTEM_PROMPT =
  'You write very short titles (6–9 words) for an ongoing chat session about a markdown vault. ' +
  'Given the existing title plus the latest user prompt and assistant reply preview, return an ' +
  'updated title that captures the overall topic. Reuse the existing title verbatim if the new ' +
  'turn does not shift the topic. Respond with ONLY the title text — no quotes, no punctuation ' +
  'at the end, no explanation.'

interface SummarizeSessionPayload {
  prevTitle: string
  userPrompt: string
  assistantPreview: string
}

function clipTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim().replace(/^["']+|["']+$/g, '')
  if (!oneLine) return ''
  if (oneLine.length <= SESSION_TITLE_MAX_CHARS) return oneLine
  return `${oneLine.slice(0, SESSION_TITLE_MAX_CHARS - 1).trimEnd()}…`
}

function buildSessionTitleMessages(payload: SummarizeSessionPayload): LLMMessage[] {
  const preview = payload.assistantPreview.slice(0, ASSISTANT_PREVIEW_MAX_CHARS)
  return [
    { role: 'system', content: SESSION_TITLE_SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        `Existing title: ${payload.prevTitle || '(none)'}\n\n` +
        `Latest user prompt:\n${payload.userPrompt}\n\n` +
        `Assistant reply preview:\n${preview}\n\n` +
        'Updated title:'
    }
  ]
}

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
            'Return ONLY the rewritten markdown. No explanation, no wrapping.\n\n' +
            DIAGRAM_BLOCKS_INSTRUCTION
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

  ipcMain.handle(
    'llm:summarizeSession',
    async (_event, payload: SummarizeSessionPayload): Promise<string> => {
      const settings = await getSettings()
      const llm = getLLMProvider({
        ...settings.llm,
        model: SESSION_TITLE_MODEL,
        maxTokens: SESSION_TITLE_MAX_TOKENS,
        temperature: SESSION_TITLE_TEMPERATURE
      })

      const response = await llm.complete(buildSessionTitleMessages(payload))
      return clipTitle(llmContentToString(response.content))
    }
  )
}
