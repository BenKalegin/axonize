import React, { useEffect, useState } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { renderMarkdown } from '../../lib/markdown-renderer'
import { useRagStore } from '../../store/rag-store'
import { SourcesList } from './SourcesList'

export const RAGAnswerView = React.memo(function RAGAnswerView() {
  const { lastResponse, clearResponse } = useRagStore()
  const [answerHtml, setAnswerHtml] = useState('')

  useEffect(() => {
    if (!lastResponse) return
    let cancelled = false
    renderMarkdown(lastResponse.answer).then((html) => {
      if (!cancelled) setAnswerHtml(html)
    })
    return () => { cancelled = true }
  }, [lastResponse?.answer])

  if (!lastResponse) return null

  return (
    <div className="rag-answer-view" data-testid={TEST_IDS.RAG_ANSWER_VIEW}>
      <div
        className="rag-answer-content markdown-view"
        dangerouslySetInnerHTML={{ __html: answerHtml }}
      />
      {lastResponse.sources.length > 0 && (
        <SourcesList sources={lastResponse.sources} onNavigate={clearResponse} />
      )}
    </div>
  )
})
