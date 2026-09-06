import { describe, expect, it } from 'vitest'
import { buildRewriteUserPrompt } from '../../../src/main/llm-ipc-handlers'

describe('llm rewrite prompt', () => {
  it('includes the active file when section rewrite has vault context', () => {
    const prompt = buildRewriteUserPrompt({
      section: '## Old\n\nBody',
      instruction: 'Make it clearer',
      vaultPath: '/vault',
      filePath: '/vault/doc.md'
    })

    expect(prompt).toContain('Current active file: /vault/doc.md')
    expect(prompt).toContain('Instruction: Make it clearer')
    expect(prompt).toContain('Section:\n## Old\n\nBody')
  })
})
