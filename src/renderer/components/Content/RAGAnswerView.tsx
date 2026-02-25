import { useEffect, useState } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { renderMarkdown } from '../../lib/markdown-renderer'
import { useRagStore } from '../../store/rag-store'
import { useEditorStore } from '../../store/editor-store'

export function RAGAnswerView() {
  const { lastResponse, clearResponse } = useRagStore()
  const { selectFile } = useEditorStore()
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

  const handleSourceClick = (filePath: string) => {
    selectFile(filePath)
    clearResponse()
  }

  return (
    <div className="rag-answer-view" data-testid={TEST_IDS.RAG_ANSWER_VIEW}>
      <div
        className="rag-answer-content markdown-view"
        dangerouslySetInnerHTML={{ __html: answerHtml }}
      />
      {lastResponse.sources.length > 0 && (
        <div className="rag-answer-sources">
          <h4 className="rag-sources-heading">Sources</h4>
          {lastResponse.sources.map((source, i) => {
            const label = source.headingPath.length > 0
              ? `${source.filePath} > ${source.headingPath.join(' > ')}`
              : source.filePath
            return (
              <button
                key={`${source.filePath}:${source.startLine}:${i}`}
                className="rag-source-link"
                data-testid={TEST_IDS.RAG_SOURCE_LINK}
                onClick={() => handleSourceClick(source.filePath)}
              >
                <span className="source-label">{label}</span>
                <span className="source-score">{(source.score * 100).toFixed(1)}%</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
