import type { ParsedRecord, RowSpan } from './types'

const LF = '\n'
const CR = '\r'

/** Find spans of non-blank lines; each line is one JSONL record. */
export function indexJsonl(text: string): RowSpan[] {
  const spans: RowSpan[] = []
  let lineStart = 0

  for (let i = 0; i < text.length; i++) {
    if (text[i] === LF) {
      pushLineSpan(spans, text, lineStart, i)
      lineStart = i + 1
    }
  }
  pushLineSpan(spans, text, lineStart, text.length)
  return spans
}

/** Parse one indexed record; malformed JSON yields an error value, never a throw. */
export function parseJsonlRecord(text: string, span: RowSpan): ParsedRecord {
  const line = text.slice(span.start, span.end)
  try {
    return { value: JSON.parse(line), error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { value: null, error: message }
  }
}

function pushLineSpan(spans: RowSpan[], text: string, start: number, end: number): void {
  const trimmedEnd = text[end - 1] === CR ? end - 1 : end
  if (isBlank(text, start, trimmedEnd)) return
  spans.push({ start, end: trimmedEnd })
}

function isBlank(text: string, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    const ch = text[i]
    if (ch !== ' ' && ch !== '\t') return false
  }
  return true
}
