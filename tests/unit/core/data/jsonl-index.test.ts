import { describe, it, expect } from 'vitest'
import { indexJsonl, parseJsonlRecord } from '@core/data/jsonl-index'

describe('jsonl-index', () => {
  it('indexes one record per line', () => {
    const text = '{"a":1}\n{"a":2}\n{"a":3}\n'
    const spans = indexJsonl(text)
    expect(spans).toHaveLength(3)
    expect(parseJsonlRecord(text, spans[1])).toEqual({ value: { a: 2 }, error: null })
  })

  it('handles missing trailing newline', () => {
    const text = '{"a":1}\n{"a":2}'
    const spans = indexJsonl(text)
    expect(spans).toHaveLength(2)
    expect(parseJsonlRecord(text, spans[1])).toEqual({ value: { a: 2 }, error: null })
  })

  it('skips blank and whitespace-only lines', () => {
    const text = '{"a":1}\n\n   \n{"a":2}\n'
    const spans = indexJsonl(text)
    expect(spans).toHaveLength(2)
    expect(parseJsonlRecord(text, spans[1])).toEqual({ value: { a: 2 }, error: null })
  })

  it('handles CRLF line endings', () => {
    const text = '{"a":1}\r\n{"a":2}\r\n'
    const spans = indexJsonl(text)
    expect(spans).toHaveLength(2)
    expect(parseJsonlRecord(text, spans[0])).toEqual({ value: { a: 1 }, error: null })
  })

  it('returns an error value for malformed JSON instead of throwing', () => {
    const text = '{"a":1}\n{bad json}\n{"a":3}\n'
    const spans = indexJsonl(text)
    expect(spans).toHaveLength(3)
    const bad = parseJsonlRecord(text, spans[1])
    expect(bad.value).toBeNull()
    expect(bad.error).toBeTruthy()
    expect(parseJsonlRecord(text, spans[2])).toEqual({ value: { a: 3 }, error: null })
  })

  it('supports scalar and array records', () => {
    const text = '42\n"hello"\n[1,2]\n'
    const spans = indexJsonl(text)
    expect(parseJsonlRecord(text, spans[0]).value).toBe(42)
    expect(parseJsonlRecord(text, spans[1]).value).toBe('hello')
    expect(parseJsonlRecord(text, spans[2]).value).toEqual([1, 2])
  })

  it('returns empty index for empty input', () => {
    expect(indexJsonl('')).toEqual([])
    expect(indexJsonl('\n\n')).toEqual([])
  })
})
