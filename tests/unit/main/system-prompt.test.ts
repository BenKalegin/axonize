import { describe, it, expect } from 'vitest'
import { defaultSystemPrompt } from '../../../src/main/agent/claude-tool-config'
import { HTML_ISLAND_INSTRUCTION } from '../../../src/main/prompts/html-island-prompts'

describe('defaultSystemPrompt — HTML islands', () => {
  it('includes the HTML island instruction', () => {
    expect(defaultSystemPrompt()).toContain(HTML_ISLAND_INSTRUCTION)
  })

  it('steers the model away from scripts (read mode is static)', () => {
    const prompt = defaultSystemPrompt()
    expect(prompt).toMatch(/```html```|HTML islands/)
    expect(prompt).toMatch(/JavaScript never executes|<script>/)
  })
})
