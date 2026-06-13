import { describe, it, expect } from 'vitest'
import { checkDanglingPronouns } from '@core/markdown/lint/rules/dangling-pronoun'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return {
    filePath: '/vault/doc.md',
    vaultPath: '/vault',
    content,
    tree: parseMarkdown(content),
    vaultFiles: new Set(),
    getFileContent: () => undefined
  }
}

describe('checkDanglingPronouns', () => {
  it('flags a section opening with "This is"', () => {
    const issues = checkDanglingPronouns(ctx('## Setup\n\nThis is the second stage of the flow.'))
    expect(issues).toHaveLength(1)
    expect(issues[0].ruleId).toBe('dangling-pronoun')
    expect(issues[0].severity).toBe('info')
    expect(issues[0].line).toBe(3)
  })

  it('flags "These are", "They provide", and "That means"', () => {
    expect(checkDanglingPronouns(ctx('## A\n\nThese are the inputs.'))).toHaveLength(1)
    expect(checkDanglingPronouns(ctx('## A\n\nThey provide three hooks.'))).toHaveLength(1)
    expect(checkDanglingPronouns(ctx('## A\n\nThat means the cache is cold.'))).toHaveLength(1)
  })

  it('flags a pronoun separated from its verb by an adverb', () => {
    expect(checkDanglingPronouns(ctx('## A\n\nThis also means a rebuild.'))).toHaveLength(1)
  })

  it('does not flag a demonstrative used as a determiner', () => {
    expect(checkDanglingPronouns(ctx('## A\n\nThis section explains the flow.'))).toHaveLength(0)
    expect(checkDanglingPronouns(ctx('## A\n\nThese steps run in order.'))).toHaveLength(0)
  })

  it('does not flag "That said," (conjunction, not pronominal)', () => {
    expect(checkDanglingPronouns(ctx('## A\n\nThat said, the defaults are fine.'))).toHaveLength(0)
  })

  it('ignores the document lead paragraph before any heading', () => {
    expect(checkDanglingPronouns(ctx('This is the intro.\n\n## A\n\nConcrete content here.'))).toHaveLength(0)
  })

  it('only inspects the first block of a section', () => {
    const md = '## A\n\nA proper opening sentence.\n\nThis is fine because it is mid-section.'
    expect(checkDanglingPronouns(ctx(md))).toHaveLength(0)
  })

  it('skips sections that open with a non-paragraph block', () => {
    const md = '## A\n\n- This is a list item, not a section opener.'
    expect(checkDanglingPronouns(ctx(md))).toHaveLength(0)
  })

  it('flags multiple offending sections independently', () => {
    const md = '## A\n\nThis is one.\n\n## B\n\nThese are two.\n\n## C\n\nThis section is fine.'
    const issues = checkDanglingPronouns(ctx(md))
    expect(issues).toHaveLength(2)
  })

  it('handles a pronoun preceded by an opening parenthesis or quote', () => {
    expect(checkDanglingPronouns(ctx('## A\n\n"This is a quoted opener," she said.'))).toHaveLength(1)
  })
})
