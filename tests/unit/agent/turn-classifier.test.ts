import { describe, it, expect } from 'vitest'
import { classifyTurn, makePreview } from '../../../src/renderer/lib/agent-turn-classifier'
import { AgentTurnKind } from '../../../src/core/agent/turn-kinds'

describe('classifyTurn', () => {
  it('treats a short "done" response as plain', () => {
    expect(classifyTurn('done')).toBe(AgentTurnKind.Plain)
  })

  it('treats a single-sentence confirmation as plain', () => {
    expect(classifyTurn('Changed the constant to 42.')).toBe(AgentTurnKind.Plain)
  })

  it('detects markdown headings as analytical', () => {
    const text = '# Findings\n\nSomething happened.'
    expect(classifyTurn(text)).toBe(AgentTurnKind.Analytical)
  })

  it('detects multi-bullet lists as analytical', () => {
    const text = '- first\n- second\n- third'
    expect(classifyTurn(text)).toBe(AgentTurnKind.Analytical)
  })

  it('does not promote a single bullet line as analytical', () => {
    expect(classifyTurn('- only one bullet')).toBe(AgentTurnKind.Plain)
  })

  it('detects fenced code blocks as analytical', () => {
    const text = '```ts\nconst x = 1\n```'
    expect(classifyTurn(text)).toBe(AgentTurnKind.Analytical)
  })

  it('detects numbered lists as analytical', () => {
    const text = '1. first step\n2. second step\n3. third step'
    expect(classifyTurn(text)).toBe(AgentTurnKind.Analytical)
  })

  it('treats empty text as plain', () => {
    expect(classifyTurn('')).toBe(AgentTurnKind.Plain)
    expect(classifyTurn('   \n\n')).toBe(AgentTurnKind.Plain)
  })
})

describe('makePreview', () => {
  it('keeps the first three non-blank lines verbatim', () => {
    const preview = makePreview('alpha\nbeta\ngamma\ndelta')
    expect(preview).toBe('alpha\nbeta\ngamma')
  })

  it('drops blank lines', () => {
    const preview = makePreview('alpha\n\n\nbeta')
    expect(preview).toBe('alpha\nbeta')
  })

  it('preserves markdown syntax so it can be rendered', () => {
    const preview = makePreview('A **Symphony** is an orchestration model.')
    expect(preview).toBe('A **Symphony** is an orchestration model.')
  })

  it('truncates long lines with an ellipsis', () => {
    const long = 'a'.repeat(500)
    const preview = makePreview(long)
    expect(preview.length).toBeLessThanOrEqual(240)
    expect(preview.endsWith('…')).toBe(true)
  })
})
