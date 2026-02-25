import { describe, it, expect } from 'vitest'
import { buildRAGPrompt } from '@core/rag/prompt-builder'
import type { SearchResult } from '@core/rag/types'

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    meta: {
      blockId: 'chunk-1',
      filePath: 'docs/guide.md',
      headingPath: ['Getting Started'],
      blockType: 'paragraph',
      startLine: 10,
      endLine: 20,
      contentPreview: 'Install the package...'
    },
    score: 0.85,
    content: 'Install the package using npm install. Then configure your settings.',
    ...overrides
  }
}

describe('buildRAGPrompt', () => {
  it('returns system and user messages', () => {
    const messages = buildRAGPrompt('How do I install?', [makeResult()])

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
  })

  it('system message instructs citation format', () => {
    const messages = buildRAGPrompt('test?', [makeResult()])
    expect(messages[0].content).toContain('[source:')
    expect(messages[0].content).toContain('filePath')
    expect(messages[0].content).toContain('startLine')
  })

  it('includes file path and heading in context block', () => {
    const messages = buildRAGPrompt('How do I install?', [makeResult()])
    const userContent = messages[1].content

    expect(userContent).toContain('docs/guide.md')
    expect(userContent).toContain('Getting Started')
    expect(userContent).toContain('Lines: 10-20')
  })

  it('includes score in context block', () => {
    const messages = buildRAGPrompt('test?', [makeResult({ score: 0.923 })])
    const userContent = messages[1].content
    expect(userContent).toContain('0.923')
  })

  it('includes the question in user message', () => {
    const question = 'What is the deployment process?'
    const messages = buildRAGPrompt(question, [makeResult()])
    expect(messages[1].content).toContain(question)
  })

  it('includes content from search results', () => {
    const content = 'Specific content about deployment steps and requirements.'
    const messages = buildRAGPrompt('test?', [
      makeResult({ content })
    ])
    expect(messages[1].content).toContain(content)
  })

  it('handles multiple results with numbered context blocks', () => {
    const results = [
      makeResult({ content: 'First result content here.', score: 0.9 }),
      makeResult({
        meta: {
          blockId: 'chunk-2',
          filePath: 'docs/api.md',
          headingPath: ['API', 'Endpoints'],
          blockType: 'code',
          startLine: 50,
          endLine: 60,
          contentPreview: 'GET /api/v1...'
        },
        content: 'GET /api/v1/users returns a list of users.',
        score: 0.75
      })
    ]

    const messages = buildRAGPrompt('How do I use the API?', results)
    const userContent = messages[1].content

    expect(userContent).toContain('Context Block 1')
    expect(userContent).toContain('Context Block 2')
    expect(userContent).toContain('docs/guide.md')
    expect(userContent).toContain('docs/api.md')
    expect(userContent).toContain('API > Endpoints')
  })

  it('handles results with empty heading path', () => {
    const result = makeResult({
      meta: {
        blockId: 'c1',
        filePath: 'readme.md',
        headingPath: [],
        blockType: 'paragraph',
        startLine: 1,
        endLine: 5,
        contentPreview: 'Some content...'
      }
    })

    const messages = buildRAGPrompt('test?', [result])
    const userContent = messages[1].content

    expect(userContent).toContain('readme.md')
    // Should not contain empty parentheses
    expect(userContent).not.toContain('()')
  })

  it('handles empty results array', () => {
    const messages = buildRAGPrompt('test?', [])
    expect(messages).toHaveLength(2)
    expect(messages[1].content).toContain('Question: test?')
  })
})
