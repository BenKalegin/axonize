import { describe, it, expect } from 'vitest'
import { checkMermaidColors } from '@core/markdown/lint/rules/mermaid-colors'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

const mermaid = (code: string) => `\`\`\`mermaid\n${code}\n\`\`\``

describe('checkMermaidColors', () => {
  it('passes when fill uses 8-digit hex (with alpha)', () => {
    const issues = checkMermaidColors(ctx(mermaid('flowchart TD\n  A --> B\n  style A fill:#6366f133,stroke:#6366f1')))
    expect(issues).toHaveLength(0)
  })

  it('passes when fill is transparent', () => {
    expect(checkMermaidColors(ctx(mermaid('flowchart TD\n  style A fill:transparent')))).toHaveLength(0)
  })

  it('flags 6-digit opaque hex fill', () => {
    const issues = checkMermaidColors(ctx(mermaid('flowchart TD\n  style A fill:#6366f1,stroke:#6366f1')))
    expect(issues).toHaveLength(1)
    expect(issues[0].ruleId).toBe('mermaid-opaque-fill')
    expect(issues[0].message).toMatch(/6366f1/)
  })

  it('does not flag opaque stroke (only fill is required to have alpha)', () => {
    const issues = checkMermaidColors(ctx(mermaid('flowchart TD\n  style A fill:#6366f133,stroke:#000000')))
    expect(issues).toHaveLength(0)
  })

  it('ignores non-mermaid code blocks', () => {
    expect(checkMermaidColors(ctx('```js\nfill:#ff0000\n```'))).toHaveLength(0)
  })
})
