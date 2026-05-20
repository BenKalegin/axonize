import type { ColumnAlign, GfmTableModel } from './types'

const PIPE = '|'
const UNESCAPED_PIPE = /(?<!\\)\|/
const DELIMITER_CELL = /^:?-{3,}:?$/
const MIN_DASHES = 3

function splitRow(line: string): string[] {
  const trimmed = line.trim()
  const body = trimmed.startsWith(PIPE) ? trimmed.slice(1) : trimmed
  const tail = body.endsWith(PIPE) && !body.endsWith('\\|') ? body.slice(0, -1) : body
  return tail.split(UNESCAPED_PIPE).map((cell) => cell.replace(/\\\|/g, '|').trim())
}

function parseAlignmentCell(cell: string): ColumnAlign {
  const trimmed = cell.trim()
  if (!DELIMITER_CELL.test(trimmed)) return null
  const left = trimmed.startsWith(':')
  const right = trimmed.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

function isDelimiterRow(line: string): boolean {
  const cells = splitRow(line)
  if (cells.length === 0) return false
  return cells.every((cell) => DELIMITER_CELL.test(cell))
}

function normalizeRow(cells: string[], columnCount: number): string[] {
  if (cells.length === columnCount) return cells
  if (cells.length > columnCount) return cells.slice(0, columnCount)
  return [...cells, ...Array(columnCount - cells.length).fill('')]
}

function padAlignment(align: ColumnAlign[], columnCount: number): ColumnAlign[] {
  if (align.length === columnCount) return align
  if (align.length > columnCount) return align.slice(0, columnCount)
  return [...align, ...Array(columnCount - align.length).fill(null)]
}

export function parseGfmTable(markdown: string): GfmTableModel | null {
  const lines = markdown.split('\n').map((line) => line.replace(/\r$/, ''))
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  if (start + 1 >= lines.length) return null
  if (!isDelimiterRow(lines[start + 1])) return null

  const headers = splitRow(lines[start])
  const align = splitRow(lines[start + 1]).map(parseAlignmentCell)
  const rows: string[][] = []
  for (let i = start + 2; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') break
    rows.push(normalizeRow(splitRow(raw), headers.length))
  }
  return { headers, rows, align: padAlignment(align, headers.length) }
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|')
}

function delimiterFor(align: ColumnAlign, width: number): string {
  const dashes = '-'.repeat(Math.max(MIN_DASHES, width))
  switch (align) {
    case 'left':
      return `:${dashes.slice(1)}`
    case 'right':
      return `${dashes.slice(0, -1)}:`
    case 'center':
      return `:${dashes.slice(2)}:`
    default:
      return dashes
  }
}

function padCell(value: string, width: number, align: ColumnAlign): string {
  if (value.length >= width) return value
  const pad = width - value.length
  if (align === 'right') return ' '.repeat(pad) + value
  if (align === 'center') {
    const left = Math.floor(pad / 2)
    return ' '.repeat(left) + value + ' '.repeat(pad - left)
  }
  return value + ' '.repeat(pad)
}

export function serializeGfmTable(model: GfmTableModel): string {
  const columnCount = model.headers.length
  const escapedHeaders = model.headers.map(escapeCell)
  const escapedRows = model.rows.map((row) => normalizeRow(row, columnCount).map(escapeCell))
  const align = padAlignment(model.align, columnCount)

  const widths = new Array<number>(columnCount).fill(MIN_DASHES)
  for (let c = 0; c < columnCount; c++) {
    widths[c] = Math.max(widths[c], escapedHeaders[c].length)
    for (const row of escapedRows) {
      widths[c] = Math.max(widths[c], row[c].length)
    }
  }

  const renderRow = (cells: string[]): string =>
    `| ${cells.map((cell, c) => padCell(cell, widths[c], align[c])).join(' | ')} |`

  const headerLine = renderRow(escapedHeaders)
  const delimiterLine = `| ${align.map((a, c) => delimiterFor(a, widths[c])).join(' | ')} |`
  const dataLines = escapedRows.map(renderRow)

  return [headerLine, delimiterLine, ...dataLines].join('\n')
}

export function createEmptyTable(columnCount: number, rowCount: number): GfmTableModel {
  return {
    headers: Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => '')),
    align: Array.from({ length: columnCount }, () => null)
  }
}
