import type { RowSpan } from './types'

/**
 * Minimal RFC 4180 CSV support: quoted fields, "" escapes, quoted newlines, CRLF.
 * Two-phase design for lazy access: `indexCsv` finds logical record spans once;
 * `parseCsvRecord` tokenizes a single record slice on demand.
 */

const QUOTE = '"'
const COMMA = ','
const LF = '\n'
const CR = '\r'
const BOM = '﻿'

export interface CsvIndex {
  headers: string[]
  /** Spans of data records (header excluded), in file order. */
  rowSpans: RowSpan[]
}

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text
}

/** Scan once, tracking quote state, to find logical record boundaries. */
export function indexCsv(text: string): CsvIndex {
  const spans = findRecordSpans(text)
  if (spans.length === 0) return { headers: [], rowSpans: [] }
  const headerSpan = spans[0]
  return {
    headers: parseCsvRecord(text.slice(headerSpan.start, headerSpan.end)),
    rowSpans: spans.slice(1)
  }
}

/** Tokenize one logical record (no unquoted newlines inside) into field values. */
export function parseCsvRecord(record: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < record.length) {
    const ch = record[i]
    if (inQuotes) {
      if (ch === QUOTE) {
        if (record[i + 1] === QUOTE) {
          field += QUOTE
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === QUOTE) {
      inQuotes = true
      i++
      continue
    }
    if (ch === COMMA) {
      fields.push(field)
      field = ''
      i++
      continue
    }
    field += ch
    i++
  }
  fields.push(field)
  return fields
}

function findRecordSpans(text: string): RowSpan[] {
  const spans: RowSpan[] = []
  let recordStart = 0
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === QUOTE) {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && ch === LF) {
      pushSpan(spans, text, recordStart, i)
      recordStart = i + 1
    }
  }
  pushSpan(spans, text, recordStart, text.length)
  return spans
}

function pushSpan(spans: RowSpan[], text: string, start: number, end: number): void {
  const trimmedEnd = text[end - 1] === CR ? end - 1 : end
  if (trimmedEnd > start) spans.push({ start, end: trimmedEnd })
}
