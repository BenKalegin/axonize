import { describe, it, expect } from 'vitest'
import { checkBrokenLinks } from '@core/markdown/lint/rules/broken-links'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(
  content: string,
  vaultFiles: string[] = [],
  files: Record<string, string> = {}
): LintContext {
  return {
    filePath: '/vault/notes/doc.md',
    vaultPath: '/vault',
    content,
    tree: parseMarkdown(content),
    vaultFiles: new Set(vaultFiles),
    getFileContent: (rel) => files[rel]
  }
}

describe('checkBrokenLinks', () => {
  it('passes when markdown link target exists', () => {
    const issues = checkBrokenLinks(ctx('[Other](other.md)', ['notes/other.md']))
    expect(issues).toHaveLength(0)
  })

  it('flags missing markdown link target', () => {
    const issues = checkBrokenLinks(ctx('[Missing](missing.md)', []))
    expect(issues).toHaveLength(1)
    expect(issues[0].ruleId).toBe('broken-link')
  })

  it('skips external http links', () => {
    expect(checkBrokenLinks(ctx('[Ext](https://example.com)'))).toHaveLength(0)
  })

  it('passes anchor-only link when heading exists in current file', () => {
    expect(checkBrokenLinks(ctx('# Section\n\n[Anchor](#section)'))).toHaveLength(0)
  })

  it('flags anchor-only link when heading missing in current file', () => {
    const issues = checkBrokenLinks(ctx('[Anchor](#missing)'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/#missing/)
  })

  it('passes cross-file anchor when heading exists in target', () => {
    const issues = checkBrokenLinks(
      ctx(
        '[Other](other.md#intro)',
        ['notes/other.md'],
        { 'notes/other.md': '# Intro\n\ntext' }
      )
    )
    expect(issues).toHaveLength(0)
  })

  it('flags cross-file anchor when heading missing in target', () => {
    const issues = checkBrokenLinks(
      ctx(
        '[Other](other.md#missing)',
        ['notes/other.md'],
        { 'notes/other.md': '# Intro\n\ntext' }
      )
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/#missing/)
  })

  it('skips cross-file anchor check when target content not provided', () => {
    const issues = checkBrokenLinks(
      ctx('[Other](other.md#anything)', ['notes/other.md'])
    )
    expect(issues).toHaveLength(0)
  })

  it('flags wikilink anchor when heading missing in target', () => {
    const issues = checkBrokenLinks(
      ctx(
        'See [[other#missing]]',
        ['notes/other.md'],
        { 'notes/other.md': '# Intro' }
      )
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/#missing/)
  })

  it('passes valid wikilink', () => {
    const issues = checkBrokenLinks(ctx('See [[other]]', ['notes/other.md']))
    expect(issues).toHaveLength(0)
  })

  it('flags missing wikilink target', () => {
    const issues = checkBrokenLinks(ctx('See [[missing]]', []))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/\[\[missing\]\]/)
  })

  it('resolves basename match for wikilinks', () => {
    const issues = checkBrokenLinks(ctx('[[design]]', ['notes/subfolder/design.md']))
    expect(issues).toHaveLength(0)
  })
})
