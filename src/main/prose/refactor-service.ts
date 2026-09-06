import { getSettings } from '../settings-service'
import { getLLMProvider } from '../rag/provider-factory'
import { llmContentToString, type LLMMessage } from '../../core/rag/types'
import { DIAGRAM_BLOCKS_INSTRUCTION } from '../prompts/diagram-prompts'

// Documents larger than this are rejected — a full-document rewrite must fit
// comfortably in one completion. No chunked fallback.
const MAX_REFACTOR_CHARS = 60_000
// Rough chars-per-token estimate for sizing the completion budget.
const CHARS_PER_TOKEN_ESTIMATE = 3
// Headroom multiplier over the input-size estimate, since a refactor may
// reorganize but must never grow the document materially.
const OUTPUT_TOKEN_HEADROOM = 1.2
const MIN_OUTPUT_TOKENS = 4096
const MAX_OUTPUT_TOKENS = 32_000
// Low temperature: fidelity over creativity — the pass must be lossless on facts.
const REFACTOR_TEMPERATURE = 0.2

const REFACTOR_SYSTEM_PROMPT =
  'You are a careful markdown document refactorer. The document below grew through ' +
  'incremental edits and has accumulated structural entropy. Produce a refactored ' +
  'version that:\n' +
  '1. De-duplicates — where the same idea is stated in multiple sections, keep the ' +
  'canonical statement and replace the rest with a short cross-reference.\n' +
  '2. Consolidates — merge overlapping sections that grew independently.\n' +
  '3. Fixes structure — repair heading hierarchy and stale manual numbering.\n' +
  '4. Tightens — trim repetition and filler introduced by incremental edits.\n' +
  '5. Matches tone — bring stylistically drifted passages in line with the rest.\n\n' +
  'HARD CONSTRAINTS:\n' +
  '- Lossless on facts: never drop information, claims, numbers, names, links, or ' +
  'examples. Only words may be lost, never content.\n' +
  '- Preserve all code fences, front matter, tables, and image references verbatim ' +
  'unless they are exact duplicates.\n' +
  '- Keep the document\'s language and overall heading organization recognizable.\n' +
  '- If the document is already coherent, return it with minimal or no changes.\n\n' +
  'Return ONLY the refactored markdown document. No preamble, no explanation, no ' +
  'code fence around the output.\n\n' +
  DIAGRAM_BLOCKS_INSTRUCTION

export interface RefactorRequest {
  content: string
  // Optional Tier-1 lint findings, passed as plain text hints to focus the pass.
  findingsSummary?: string
}

function buildMessages(request: RefactorRequest): LLMMessage[] {
  const hints = request.findingsSummary
    ? `Known lint findings to address:\n${request.findingsSummary}\n\n`
    : ''
  return [
    { role: 'system', content: REFACTOR_SYSTEM_PROMPT },
    { role: 'user', content: `${hints}Document:\n\n${request.content}` }
  ]
}

function outputTokenBudget(contentLength: number): number {
  const estimate = Math.ceil((contentLength / CHARS_PER_TOKEN_ESTIMATE) * OUTPUT_TOKEN_HEADROOM)
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, estimate))
}

export async function refactorDocument(request: RefactorRequest): Promise<string> {
  if (request.content.length > MAX_REFACTOR_CHARS) {
    throw new Error(
      `Document is too large to refactor in one pass (${request.content.length} chars, max ${MAX_REFACTOR_CHARS})`
    )
  }
  const settings = await getSettings()
  const llm = getLLMProvider({
    ...settings.llm,
    maxTokens: outputTokenBudget(request.content.length),
    temperature: REFACTOR_TEMPERATURE
  })
  const response = await llm.complete(buildMessages(request))
  const refactored = llmContentToString(response.content).trim()
  if (!refactored) throw new Error('LLM returned an empty refactor result')
  return refactored
}
