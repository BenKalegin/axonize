import type { LLMMessage, SearchResult } from './types'

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about a documentation vault.
You MUST cite your sources using this exact format: [source:filePath:startLine]
For example: [source:docs/guide.md:42]

When citing, use the file path and start line from the provided context blocks.
If you cannot answer from the provided context, say so clearly.
Be concise and accurate. Prefer direct quotes when relevant.`

export function buildRAGPrompt(question: string, results: SearchResult[]): LLMMessage[] {
  const contextBlocks = results
    .map((result, index) => {
      const heading =
        result.meta.headingPath.length > 0
          ? ` (${result.meta.headingPath.join(' > ')})`
          : ''
      return `--- Context Block ${index + 1} ---
File: ${result.meta.filePath}${heading}
Lines: ${result.meta.startLine}-${result.meta.endLine}
Score: ${result.score.toFixed(3)}

${result.content}`
    })
    .join('\n\n')

  const userMessage = `Context from the documentation vault:

${contextBlocks}

---

Question: ${question}`

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ]
}
