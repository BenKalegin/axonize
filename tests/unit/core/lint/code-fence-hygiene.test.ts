import { describe, it, expect } from 'vitest'
import { checkCodeFenceHygiene } from '@core/markdown/lint/rules/code-fence-hygiene'
import { parseMarkdown } from '@core/markdown/parser'
import type { LintContext } from '@core/markdown/lint/types'

function ctx(content: string): LintContext {
  return { filePath: '/vault/doc.md', vaultPath: '/vault', content, tree: parseMarkdown(content), vaultFiles: new Set(), getFileContent: () => undefined }
}

describe('checkCodeFenceHygiene', () => {
  it('passes labeled fences with known languages', () => {
    expect(checkCodeFenceHygiene(ctx('```typescript\nconst a = 1\n```\n\n```json\n{}\n```'))).toHaveLength(0)
  })

  it('flags an unlabeled fence', () => {
    const issues = checkCodeFenceHygiene(ctx('```\nplain stuff\n```'))
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('info')
    expect(issues[0].message).toMatch(/Unlabeled/)
    expect(issues[0].line).toBe(1)
  })

  it('flags an unknown language tag', () => {
    const issues = checkCodeFenceHygiene(ctx('```pyton\nprint(1)\n```'))
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].message).toMatch(/"pyton"/)
  })

  it('accepts language aliases', () => {
    expect(checkCodeFenceHygiene(ctx('```ts\nconst a = 1\n```\n\n```sh\nls\n```'))).toHaveLength(0)
  })

  it('accepts app-special fences like mermaid and bpmn', () => {
    expect(checkCodeFenceHygiene(ctx('```mermaid\nflowchart LR\n```\n\n```bpmn\n<xml/>\n```'))).toHaveLength(0)
  })

  it('is case-insensitive for language tags', () => {
    expect(checkCodeFenceHygiene(ctx('```TypeScript\nconst a = 1\n```'))).toHaveLength(0)
  })

  it('checks fences nested in lists', () => {
    const issues = checkCodeFenceHygiene(ctx('- item\n\n  ```\n  nested\n  ```'))
    expect(issues).toHaveLength(1)
  })

  it('returns no issues for content without fences', () => {
    expect(checkCodeFenceHygiene(ctx('# Heading\n\nJust prose.'))).toHaveLength(0)
  })
})
