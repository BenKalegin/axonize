import { describe, it, expect } from 'vitest'
import { checkOrphanedFootnotes } from '@core/markdown/lint/rules/orphaned-footnotes'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

describe('checkOrphanedFootnotes', () => {
  it('passes when every ref has a definition', () => {
    expect(checkOrphanedFootnotes(ctx('Text[^1] here.\n\n[^1]: The footnote.'))).toHaveLength(0)
  })

  it('flags ref without definition', () => {
    const issues = checkOrphanedFootnotes(ctx('Text[^1] here.'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/reference.*\^\s*1|no definition/)
  })

  it('flags definition without ref', () => {
    const issues = checkOrphanedFootnotes(ctx('[^unused]: Nobody references me.'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/definition.*unused|never referenced/)
  })

  it('passes for empty content', () => {
    expect(checkOrphanedFootnotes(ctx(''))).toHaveLength(0)
  })
})
