import { TEST_IDS } from '../../lib/testids'
import { useLLMLogStore } from '../../store/llm-log-store'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

export function LLMLogPanel() {
  const { entries, clearLog } = useLLMLogStore()

  return (
    <div className="llm-log-panel" data-testid={TEST_IDS.LLM_LOG_PANEL}>
      <div className="sidebar-header llm-log-header">
        <span>LLM Log</span>
        <button
          className="llm-log-clear-btn"
          data-testid={TEST_IDS.LLM_LOG_CLEAR_BTN}
          onClick={clearLog}
          title="Clear log"
        >
          &times;
        </button>
      </div>
      <div className="llm-log-list">
        {entries.length === 0 ? (
          <div className="llm-log-empty">No queries yet</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="llm-log-entry"
              data-testid={TEST_IDS.LLM_LOG_ENTRY}
            >
              <div className="llm-log-entry-time">{formatTime(entry.timestamp)}</div>
              <div className="llm-log-entry-question">{truncate(entry.question, 80)}</div>
              {entry.isLoading ? (
                <div className="llm-log-entry-status loading">Querying...</div>
              ) : entry.error ? (
                <div className="llm-log-entry-status error">{truncate(entry.error, 100)}</div>
              ) : (
                <div className="llm-log-entry-status success">
                  {truncate(entry.answer ?? '', 100)}
                  {entry.sources && entry.sources.length > 0 && (
                    <span className="llm-log-source-count">
                      {entry.sources.length} source{entry.sources.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
