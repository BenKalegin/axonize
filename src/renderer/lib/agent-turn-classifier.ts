import { AgentTurnKind } from '@core/agent/turn-kinds'

const MIN_ANALYTICAL_CHAR_COUNT = 280
const MIN_BULLETS_FOR_ANALYTICAL = 2
const PREVIEW_LINE_COUNT = 3
const PREVIEW_MAX_CHARS = 240

const HEADING_REGEX = /^#{1,6}\s+\S/m
const FENCED_CODE_REGEX = /^```/m
const BULLET_LINE_REGEX = /^[ \t]*[-*+]\s+\S/gm
const NUMBERED_LINE_REGEX = /^[ \t]*\d+\.\s+\S/gm
const TABLE_REGEX = /^\s*\|.+\|\s*$[\r\n]+\s*\|?[\s:|-]+\|?\s*$/m
const BOLD_RUN_REGEX = /\*\*[^*\n]{4,}\*\*/

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function hasAnalyticalStructure(text: string): boolean {
  if (HEADING_REGEX.test(text)) return true
  if (FENCED_CODE_REGEX.test(text)) return true
  if (TABLE_REGEX.test(text)) return true
  const bulletCount = countMatches(text, BULLET_LINE_REGEX) + countMatches(text, NUMBERED_LINE_REGEX)
  if (bulletCount >= MIN_BULLETS_FOR_ANALYTICAL) return true
  if (text.length >= MIN_ANALYTICAL_CHAR_COUNT && BOLD_RUN_REGEX.test(text)) return true
  return false
}

export function classifyTurn(text: string): AgentTurnKind {
  const trimmed = text.trim()
  if (!trimmed) return AgentTurnKind.Plain
  return hasAnalyticalStructure(trimmed) ? AgentTurnKind.Analytical : AgentTurnKind.Plain
}

export function makePreview(text: string): string {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  const head = lines.slice(0, PREVIEW_LINE_COUNT).join('\n')
  if (head.length <= PREVIEW_MAX_CHARS) return head
  return `${head.slice(0, PREVIEW_MAX_CHARS - 1)}…`
}
