import { describe, it, expect } from 'vitest'
import { checkDuplicateHeadings } from '@core/markdown/lint/rules/duplicate-headings'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

describe('checkDuplicateHeadings', () => {
  it('passes when all headings are unique', () => {
    expect(checkDuplicateHeadings(ctx('# Intro\n## Details\n### Examples'))).toHaveLength(0)
  })

  it('flags duplicate heading text', () => {
    const issues = checkDuplicateHeadings(ctx('# Setup\n## Steps\n# Setup'))
    expect(issues).toHaveLength(1)
    expect(issues[0].ruleId).toBe('duplicate-heading')
    expect(issues[0].message).toMatch(/#setup/)
  })

  it('is case-insensitive for slug generation', () => {
    const issues = checkDuplicateHeadings(ctx('# Overview\n# overview'))
    expect(issues).toHaveLength(1)
  })

  it('returns no issues for empty content', () => {
    expect(checkDuplicateHeadings(ctx(''))).toHaveLength(0)
  })
})
