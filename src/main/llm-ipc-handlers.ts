import { ipcMain } from 'electron'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import { createAgent } from './agent/agent-factory'
import { AgentEventType } from './agent/agent'
import { llmContentToString, type AgentConfig, type LLMConfig, type LLMMessage } from '../core/rag/types'
import log from './logger'
import { DIAGRAM_BLOCKS_INSTRUCTION } from './prompts/diagram-prompts'
import { HTML_ISLAND_INSTRUCTION } from './prompts/html-island-prompts'

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

const REWRITE_SYSTEM_PROMPT =
  'You are Axonize Agent running in section rewrite mode. ' +
  'Rewrite the given markdown section according to the user instruction. ' +
  'Do not edit files, do not run commands, and do not explain your changes. ' +
  'Return ONLY the rewritten markdown. No explanation, no wrapping.\n\n' +
  DIAGRAM_BLOCKS_INSTRUCTION +
  '\n\n' +
  HTML_ISLAND_INSTRUCTION

interface SummarizeSessionPayload {
  prevTitle: string
  userPrompt: string
  assistantPreview: string
}

interface RewriteSectionPayload {
  section: string
  instruction: string
  vaultPath?: string | null
  filePath?: string | null
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

export function buildRewriteUserPrompt(payload: RewriteSectionPayload): string {
  return [
    payload.filePath ? `Current active file: ${payload.filePath}` : '',
    `Instruction: ${payload.instruction}`,
    '',
    'Section:',
    payload.section
  ].filter((part) => part !== '').join('\n')
}

function buildRewriteMessages(payload: RewriteSectionPayload): LLMMessage[] {
  return [
    {
      role: 'system',
      content: REWRITE_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: buildRewriteUserPrompt(payload)
    }
  ]
}

function rewriteVaultPath(payload: RewriteSectionPayload): string | null {
  const vaultPath = payload.vaultPath?.trim()
  return vaultPath ? vaultPath : null
}

async function rewriteSectionWithLLM(config: LLMConfig, payload: RewriteSectionPayload): Promise<string> {
  const llm = getLLMProvider(config)
  const response = await llm.complete(buildRewriteMessages(payload))
  return llmContentToString(response.content)
}

async function rewriteSectionWithAgent(config: AgentConfig, payload: RewriteSectionPayload): Promise<string> {
  const vaultPath = rewriteVaultPath(payload)
  if (!vaultPath) {
    throw new Error('Cannot run agent-backed rewrite without a vault path.')
  }

  const agent = createAgent(config)
  const abort = new AbortController()
  let result = ''

  for await (const event of agent.run({
    prompt: buildRewriteUserPrompt(payload),
    vaultPath,
    allowEdits: false,
    systemPrompt: REWRITE_SYSTEM_PROMPT,
    abortSignal: abort.signal
  })) {
    if (event.type === AgentEventType.TextDelta) {
      result += event.text
    } else if (event.type === AgentEventType.Error) {
      throw new Error(event.error)
    }
  }

  if (result.trim().length === 0) {
    throw new Error('Agent rewrite produced no output.')
  }
  return result
}

export function registerLLMIpcHandlers(): void {
  ipcMain.handle(
    'llm:rewriteSection',
    async (_event, payload: RewriteSectionPayload) => {
      const settings = await getSettings()

      try {
        if (rewriteVaultPath(payload)) {
          return await rewriteSectionWithAgent(settings.agent, payload)
        }
        return await rewriteSectionWithLLM(settings.llm, payload)
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
