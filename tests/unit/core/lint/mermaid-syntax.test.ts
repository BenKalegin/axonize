import { describe, it, expect } from 'vitest'
import { checkMermaidSyntax } from '@core/markdown/lint/rules/mermaid-syntax'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

const mermaid = (code: string) => `\`\`\`mermaid\n${code}\n\`\`\``

describe('checkMermaidSyntax', () => {
  it('flags <br> tag inside mermaid node label', () => {
    const issues = checkMermaidSyntax(ctx(mermaid('flowchart TD\n  A["label<br/>continues"]')))
    expect(issues).toHaveLength(1)
    expect(issues[0].ruleId).toBe('mermaid-syntax')
    expect(issues[0].message).toMatch(/<br>/)
  })

  it('flags <br> variant without slash', () => {
    const issues = checkMermaidSyntax(ctx(mermaid('flowchart TD\n  A["<br>line"]')))
    expect(issues).toHaveLength(1)
  })

  it('passes clean mermaid diagram', () => {
    expect(checkMermaidSyntax(ctx(mermaid('flowchart TD\n  A --> B')))).toHaveLength(0)
  })

  it('ignores non-mermaid code blocks', () => {
    expect(checkMermaidSyntax(ctx('```text\ngraph["test<br/>test"]\n```'))).toHaveLength(0)
  })

  it('does not flag cylinder shape with parens-as-shape-syntax', () => {
    const diagram = 'flowchart LR\n  TDB[(Tenant Postgres\\nSQLAlchemy + pgvector)]'
    expect(checkMermaidSyntax(ctx(mermaid(diagram)))).toHaveLength(0)
  })

  it('still flags unquoted parenthesized label in rectangle node', () => {
    const diagram = 'flowchart LR\n  A[label with (parens) here]'
    const issues = checkMermaidSyntax(ctx(mermaid(diagram)))
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/may need quoting/)
  })
})
