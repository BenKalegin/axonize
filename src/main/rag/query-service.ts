import { readFile } from 'fs/promises'
import { join } from 'path'
import { getSettings } from '../settings-service'
import { buildRAGPrompt } from '../../core/rag/prompt-builder'
import { getEmbeddingProvider, getLLMProvider } from './provider-factory'
import { topKSimilar } from '../../core/rag/vector-math'
import { loadIndexState, loadMetadata, loadVectors } from './embedding-store'
import type { RAGQueryResult, SearchResult } from '../../core/rag/types'

export async function executeQuery(
  vaultPath: string,
  question: string
): Promise<RAGQueryResult> {
  const settings = await getSettings()
  const provider = await getEmbeddingProvider()

  const state = await loadIndexState(vaultPath)
  if (!state || state.chunkCount === 0) {
    throw new Error('No index found. Run indexing first.')
  }

  const metadata = await loadMetadata(vaultPath)
  const vectors = await loadVectors(vaultPath)

  const queryVector = await provider.embed(question)
  const topK = topKSimilar(queryVector, vectors, state.dimensions, settings.rag.topK)

  const results: SearchResult[] = []
  for (const match of topK) {
    if (match.score < settings.rag.minScore) {
      continue
    }

    const meta = metadata[match.index]
    if (!meta) {
      continue
    }

    let content = meta.contentPreview
    try {
      const fullPath = join(vaultPath, meta.filePath)
      const fileContent = await readFile(fullPath, 'utf-8')
      const lines = fileContent.split('\n')
      content = lines.slice(meta.startLine - 1, meta.endLine).join('\n')
    } catch {
      // Fall back to contentPreview
    }

    results.push({ meta, score: match.score, content })
  }

  if (results.length === 0) {
    return {
      answer: 'No relevant context found in the indexed documents for this question.',
      suggestedTitle: question.slice(0, 60),
      sources: []
    }
  }

  const messages = buildRAGPrompt(question, results)
  const llm = getLLMProvider(settings.llm)
  const response = await llm.complete(messages)

  const { title, body } = extractTitle(response.content, question)

  return {
    answer: body,
    suggestedTitle: title,
    sources: results.map((r) => ({
      filePath: r.meta.filePath,
      startLine: r.meta.startLine,
      headingPath: r.meta.headingPath,
      score: r.score,
      contentPreview: r.meta.contentPreview
    }))
  }
}

function extractTitle(content: string, fallback: string): { title: string; body: string } {
  const match = content.match(/^<!--\s*title:\s*(.+?)\s*-->\s*\n?/)
  if (match) {
    return { title: match[1].trim(), body: content.slice(match[0].length) }
  }
  return { title: fallback.slice(0, 60), body: content }
}
