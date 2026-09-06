import { describe, it, expect } from 'vitest'
import { checkLexicalRepetition } from '@core/markdown/lint/rules/lexical-repetition'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

const LONG_PARAGRAPH =
  'The deterministic core idea means every transformation must be reproducible from the stored inputs without any model call involved at render time.'

describe('checkLexicalRepetition', () => {
  it('passes for distinct paragraphs', () => {
    const content = `${LONG_PARAGRAPH}\n\nA completely different topic covering release automation, certificate management, and continuous integration pipelines for desktop applications.`
    expect(checkLexicalRepetition(ctx(content))).toHaveLength(0)
  })

  it('flags an exact duplicate paragraph', () => {
    const content = `${LONG_PARAGRAPH}\n\nSome unrelated filler text in between sections.\n\n${LONG_PARAGRAPH}`
    const issues = checkLexicalRepetition(ctx(content))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/100% similar to the one at line 1/)
    expect(issues[0].line).toBe(5)
  })

  it('flags a near-duplicate paragraph with small edits', () => {
    const variant = LONG_PARAGRAPH.replace('every transformation', 'each transformation')
    const issues = checkLexicalRepetition(ctx(`${LONG_PARAGRAPH}\n\n${variant}`))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/% similar/)
  })

  it('ignores short repeated paragraphs', () => {
    expect(checkLexicalRepetition(ctx('See the appendix.\n\nSee the appendix.'))).toHaveLength(0)
  })

  it('flags a long sentence repeated inside otherwise different paragraphs', () => {
    const sentence = 'The semantic index must be rebuilt whenever the card schema changes in any way.'
    const content = `${sentence} This first paragraph then talks about indexing strategies at length.\n\nMeanwhile the second paragraph discusses user interface concerns. ${sentence}`
    const issues = checkLexicalRepetition(ctx(content))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/Sentence repeats one at line 1/)
  })

  it('does not double-report a sentence inside an already flagged paragraph pair', () => {
    const content = `${LONG_PARAGRAPH}\n\n${LONG_PARAGRAPH}`
    const issues = checkLexicalRepetition(ctx(content))
    expect(issues).toHaveLength(1)
  })

  it('ignores short repeated sentences', () => {
    const content = 'It works. The rest of this paragraph is about parsing.\n\nIt works. This other paragraph is about rendering instead.'
    expect(checkLexicalRepetition(ctx(content))).toHaveLength(0)
  })

  it('is robust to punctuation and case differences', () => {
    const variant = LONG_PARAGRAPH.toUpperCase()
    const issues = checkLexicalRepetition(ctx(`${LONG_PARAGRAPH}\n\n${variant}`))
    expect(issues).toHaveLength(1)
  })

  it('returns no issues for empty content', () => {
    expect(checkLexicalRepetition(ctx(''))).toHaveLength(0)
  })
})
