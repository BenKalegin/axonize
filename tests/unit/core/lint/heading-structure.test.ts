import { describe, it, expect } from 'vitest'
import { checkHeadingStructure } from '@core/markdown/lint/rules/heading-structure'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

describe('checkHeadingStructure', () => {
  it('passes when heading levels increase by one', () => {
    expect(checkHeadingStructure(ctx('# A\n## B\n### C\n## D'))).toHaveLength(0)
  })

  it('flags a skipped heading level', () => {
    const issues = checkHeadingStructure(ctx('# A\n### B'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/h1 to h3/)
    expect(issues[0].severity).toBe('warning')
  })

  it('allows jumping back up by any amount', () => {
    expect(checkHeadingStructure(ctx('# A\n## B\n### C\n# D'))).toHaveLength(0)
  })

  it('does not flag the first heading regardless of depth', () => {
    expect(checkHeadingStructure(ctx('### Deep start\n#### Next'))).toHaveLength(0)
  })

  it('passes sequential manual numbering', () => {
    expect(checkHeadingStructure(ctx('## 1. Intro\n## 2. Setup\n## 3. Usage'))).toHaveLength(0)
  })

  it('flags a gap in manual numbering', () => {
    const issues = checkHeadingStructure(ctx('## 1. Intro\n## 2. Setup\n## 4. Usage'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/from 2 to 4/)
    expect(issues[0].line).toBe(3)
  })

  it('flags a repeated manual number', () => {
    const issues = checkHeadingStructure(ctx('## 1. Intro\n## 1. Setup'))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/from 1 to 1/)
  })

  it('resets numbering runs when a shallower heading intervenes', () => {
    const content = '# Part A\n## 1. Intro\n## 2. Setup\n# Part B\n## 1. Intro\n## 2. Setup'
    expect(checkHeadingStructure(ctx(content))).toHaveLength(0)
  })

  it('does not mix numbering runs across depths', () => {
    expect(checkHeadingStructure(ctx('## 1. Intro\n### 1. Detail\n### 2. More'))).toHaveLength(0)
  })

  it('ignores unnumbered headings between numbered runs at the same depth', () => {
    const issues = checkHeadingStructure(ctx('## 1. Intro\n## Notes\n## 5. Usage'))
    expect(issues).toHaveLength(0)
  })

  it('supports parenthesis-style numbering', () => {
    const issues = checkHeadingStructure(ctx('## 1) Intro\n## 3) Usage'))
    expect(issues).toHaveLength(1)
  })

  it('returns no issues for empty content', () => {
    expect(checkHeadingStructure(ctx(''))).toHaveLength(0)
  })
})
