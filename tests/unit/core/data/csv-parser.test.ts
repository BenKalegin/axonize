import { describe, it, expect } from 'vitest'
import { indexCsv, parseCsvRecord, stripBom } from '@core/data/csv-parser'

function rowAt(text: string, index: ReturnType<typeof indexCsv>, i: number): string[] {
  const span = index.rowSpans[i]
  return parseCsvRecord(text.slice(span.start, span.end))
}

describe('csv-parser', () => {
  it('parses a simple file with header and rows', () => {
    const text = 'a,b,c\n1,2,3\n4,5,6\n'
    const index = indexCsv(text)
    expect(index.headers).toEqual(['a', 'b', 'c'])
    expect(index.rowSpans).toHaveLength(2)
    expect(rowAt(text, index, 0)).toEqual(['1', '2', '3'])
    expect(rowAt(text, index, 1)).toEqual(['4', '5', '6'])
  })

  it('handles quoted fields with commas', () => {
    const text = 'name,note\nalice,"hello, world"\n'
    const index = indexCsv(text)
    expect(rowAt(text, index, 0)).toEqual(['alice', 'hello, world'])
  })

  it('handles quoted newlines inside a field', () => {
    const text = 'name,note\nalice,"line one\nline two"\nbob,plain\n'
    const index = indexCsv(text)
    expect(index.rowSpans).toHaveLength(2)
    expect(rowAt(text, index, 0)).toEqual(['alice', 'line one\nline two'])
    expect(rowAt(text, index, 1)).toEqual(['bob', 'plain'])
  })

  it('handles escaped quotes ("" inside quoted field)', () => {
    const text = 'a\n"she said ""hi"""\n'
    const index = indexCsv(text)
    expect(rowAt(text, index, 0)).toEqual(['she said "hi"'])
  })

  it('handles CRLF line endings', () => {
    const text = 'a,b\r\n1,2\r\n3,4\r\n'
    const index = indexCsv(text)
    expect(index.headers).toEqual(['a', 'b'])
    expect(rowAt(text, index, 0)).toEqual(['1', '2'])
    expect(rowAt(text, index, 1)).toEqual(['3', '4'])
  })

  it('strips a BOM', () => {
    expect(stripBom('﻿a,b')).toBe('a,b')
    expect(stripBom('a,b')).toBe('a,b')
  })

  it('handles missing trailing newline', () => {
    const text = 'a,b\n1,2'
    const index = indexCsv(text)
    expect(index.rowSpans).toHaveLength(1)
    expect(rowAt(text, index, 0)).toEqual(['1', '2'])
  })

  it('preserves empty fields', () => {
    const text = 'a,b,c\n1,,3\n'
    const index = indexCsv(text)
    expect(rowAt(text, index, 0)).toEqual(['1', '', '3'])
  })

  it('returns empty index for empty input', () => {
    const index = indexCsv('')
    expect(index.headers).toEqual([])
    expect(index.rowSpans).toEqual([])
  })

  it('handles header-only files', () => {
    const index = indexCsv('a,b,c\n')
    expect(index.headers).toEqual(['a', 'b', 'c'])
    expect(index.rowSpans).toEqual([])
  })
})
