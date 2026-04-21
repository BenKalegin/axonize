import React from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useRagStore } from '../../store/rag-store'
import { SourcesList } from './SourcesList'
import { MarkdownContent } from './MarkdownContent'

export const RAGAnswerView = React.memo(function RAGAnswerView() {
  const { lastResponse, clearResponse } = useRagStore()

  if (!lastResponse) return null

  return (
    <div className="rag-answer-view" data-testid={TEST_IDS.RAG_ANSWER_VIEW}>
      <MarkdownContent markdown={lastResponse.answer} className="rag-answer-content" />
      {lastResponse.sources.length > 0 && (
        <SourcesList sources={lastResponse.sources} onNavigate={clearResponse} />
      )}
    </div>
  )
})
