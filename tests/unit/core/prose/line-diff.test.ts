import { describe, it, expect } from 'vitest'
import {
  diffLines,
  diffStats,
  hasChanges,
  collapseContext,
  DiffLineKind
} from '@core/prose/line-diff'

function kinds(before: string, after: string): string[] {
  return diffLines(before, after).map((s) => `${s.kind}:${s.lines.length}`)
}

describe('diffLines', () => {
  it('returns a single context segment for identical input', () => {
    const segments = diffLines('a\nb\nc', 'a\nb\nc')
    expect(segments).toEqual([{ kind: DiffLineKind.context, lines: ['a', 'b', 'c'] }])
    expect(hasChanges(segments)).toBe(false)
  })

  it('detects a pure insertion', () => {
    expect(kinds('a\nc', 'a\nb\nc')).toEqual(['context:1', 'added:1', 'context:1'])
  })

  it('detects a pure deletion', () => {
    expect(kinds('a\nb\nc', 'a\nc')).toEqual(['context:1', 'removed:1', 'context:1'])
  })

  it('orders removals before additions in a replacement block', () => {
    const segments = diffLines('a\nold line\nc', 'a\nnew line\nc')
    expect(segments.map((s) => s.kind)).toEqual([
      DiffLineKind.context,
      DiffLineKind.removed,
      DiffLineKind.added,
      DiffLineKind.context
    ])
    expect(segments[1].lines).toEqual(['old line'])
    expect(segments[2].lines).toEqual(['new line'])
  })

  it('handles complete replacement', () => {
    const segments = diffLines('a\nb', 'x\ny\nz')
    expect(diffStats(segments)).toEqual({ added: 3, removed: 2 })
  })

  it('handles empty before', () => {
    expect(kinds('', 'a\nb')).toEqual(['removed:1', 'added:2'])
  })

  it('handles multiple separated change blocks', () => {
    const before = 'one\ntwo\nthree\nfour\nfive'
    const after = 'ONE\ntwo\nthree\nfour\nFIVE'
    const segments = diffLines(before, after)
    const changeBlocks = segments.filter((s) => s.kind !== DiffLineKind.context)
    expect(changeBlocks).toHaveLength(4)
    expect(diffStats(segments)).toEqual({ added: 2, removed: 2 })
  })

  it('round-trips: context + added reconstruct the after text', () => {
    const before = 'alpha\nbeta\ngamma\ndelta'
    const after = 'alpha\nbeta two\ngamma\ndelta\nepsilon'
    const reconstructed = diffLines(before, after)
      .filter((s) => s.kind !== DiffLineKind.removed)
      .flatMap((s) => s.lines)
      .join('\n')
    expect(reconstructed).toBe(after)
  })

  it('round-trips: context + removed reconstruct the before text', () => {
    const before = 'alpha\nbeta\ngamma\ndelta'
    const after = 'beta\ngamma two\ndelta'
    const reconstructed = diffLines(before, after)
      .filter((s) => s.kind !== DiffLineKind.added)
      .flatMap((s) => s.lines)
      .join('\n')
    expect(reconstructed).toBe(before)
  })

  it('diffs a larger document quickly', () => {
    const before = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join('\n')
    const after = before.replace('line 500', 'line five hundred').replace('line 1500', 'changed')
    const segments = diffLines(before, after)
    expect(diffStats(segments)).toEqual({ added: 2, removed: 2 })
  })
})

describe('collapseContext', () => {
  const ctx = (n: number) => ({
    kind: DiffLineKind.context,
    lines: Array.from({ length: n }, (_, i) => `c${i}`)
  })
  const add = { kind: DiffLineKind.added, lines: ['new'] }

  it('keeps short context runs intact', () => {
    const collapsed = collapseContext([ctx(2), add, ctx(2)])
    expect(collapsed).toHaveLength(3)
    expect(collapsed.every((s) => s !== null)).toBe(true)
  })

  it('collapses a long middle context run with a null separator', () => {
    const collapsed = collapseContext([add, ctx(20), add])
    expect(collapsed.map((s) => (s === null ? 'gap' : s.kind))).toEqual([
      'added', 'context', 'gap', 'context', 'added'
    ])
    const [, before, , after] = collapsed
    expect(before!.lines).toHaveLength(3)
    expect(after!.lines).toHaveLength(3)
  })

  it('drops leading context entirely beyond the kept tail', () => {
    const collapsed = collapseContext([ctx(20), add])
    expect(collapsed[0]).toBeNull()
    expect(collapsed[1]!.lines).toHaveLength(3)
    expect(collapsed[2]).toEqual(add)
  })
})
