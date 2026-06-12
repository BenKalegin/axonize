import { describe, it, expect } from 'vitest'
import { checkLatexTilde } from '@core/markdown/lint/rules/latex-tilde'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

describe('checkLatexTilde', () => {
  it('flags subscript-shaped tilde wraps', () => {
    const issues = checkLatexTilde(ctx('Water is H~2~O.'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/~2~/)
  })

  it('flags index-style subscripts', () => {
    expect(checkLatexTilde(ctx('the term x~i~ in the sum'))).toHaveLength(1)
  })

  it('ignores a standalone approximation tilde', () => {
    expect(checkLatexTilde(ctx('Accuracy is ~90% on the benchmark.'))).toHaveLength(0)
  })

  it('does not pair two approximation tildes on one line', () => {
    expect(checkLatexTilde(ctx('| ~90% | ~12% |'))).toHaveLength(0)
  })

  it('does not pair approximation tildes across a sentence', () => {
    expect(checkLatexTilde(ctx('Takes ~5s locally and ~30s in CI.'))).toHaveLength(0)
  })

  it('ignores GFM strikethrough', () => {
    expect(checkLatexTilde(ctx('this is ~~struck~~ text'))).toHaveLength(0)
  })

  it('ignores tildes inside inline code and fences', () => {
    expect(checkLatexTilde(ctx('`a~b~c` and\n\n```\nx~i~\n```'))).toHaveLength(0)
  })
})
