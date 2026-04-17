import { useEffect, useMemo, useRef } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore } from '@/store/agent-store'
import { useVaultStore } from '@/store/vault-store'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AgentPanel() {
  const vaultPath = useVaultStore((state) => state.vaultPath)
  const {
    sessions,
    selectedSessionId,
    runningSessionId,
    error,
    hydrate,
    createSession,
    deleteSession,
    selectSession,
    updateContext,
    updatePromptDraft,
    sendPrompt
  } = useAgentStore()

  useEffect(() => {
    hydrate(vaultPath)
  }, [hydrate, vaultPath])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )
  const threadRef = useRef<HTMLDivElement>(null)

  const isRunning = selectedSession ? runningSessionId === selectedSession.id : false

  useEffect(() => {
    const node = threadRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [selectedSession?.id, selectedSession?.messages.length, isRunning])

  return (
    <div className="agent-panel" data-testid={TEST_IDS.AGENT_PANEL}>
      <div className="sidebar-header agent-header">
        <span>Agent Sessions</span>
        <button
          className="agent-new-session-btn"
          data-testid={TEST_IDS.AGENT_NEW_SESSION_BTN}
          onClick={() => createSession(vaultPath)}
          title="New session"
        >
          +
        </button>
      </div>

      <div className="agent-layout">
        <aside className="agent-sessions-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`agent-session-item${session.id === selectedSessionId ? ' active' : ''}`}
              data-testid={TEST_IDS.AGENT_SESSION_ITEM}
              onClick={() => selectSession(session.id)}
            >
              <div className="agent-session-main">
                <span className="agent-session-name">{session.name}</span>
                <span className="agent-session-time">{formatTime(session.updatedAt)}</span>
              </div>
              <div className="agent-session-meta">{session.messages.length} msg</div>
              <span
                className="agent-delete-session-btn"
                data-testid={TEST_IDS.AGENT_DELETE_SESSION_BTN}
                title="Delete session"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  deleteSession(vaultPath, session.id)
                }}
              >
                ×
              </span>
            </button>
          ))}
        </aside>

        <section className="agent-workspace">
          {!selectedSession ? (
            <div className="agent-empty-state">
              No session selected.
            </div>
          ) : (
            <>
              <label className="agent-input-group">
                <span>Session Context</span>
                <textarea
                  data-testid={TEST_IDS.AGENT_CONTEXT_INPUT}
                  className="agent-context-input"
                  placeholder="Describe the goal, constraints, and relevant vault paths..."
                  value={selectedSession.context}
                  onChange={(event) =>
                    updateContext(vaultPath, selectedSession.id, event.target.value)
                  }
                />
              </label>

              <div
                ref={threadRef}
                className="agent-thread"
              >
                {selectedSession.messages.length === 0 ? (
                  <div className="agent-thread-empty">
                    Start by entering a prompt below. This is separate from RAG query mode.
                  </div>
                ) : (
                  selectedSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`agent-message agent-message--${message.role}`}
                      data-testid={TEST_IDS.AGENT_MESSAGE}
                    >
                      <div className="agent-message-role">
                        {message.role === 'user' ? 'You' : 'Agent'}
                      </div>
                      <div className="agent-message-content">{message.content}</div>
                    </div>
                  ))
                )}
                {isRunning && (
                  <div className="agent-message agent-message--assistant agent-message--pending">
                    <div className="agent-message-role">Agent</div>
                    <div className="agent-message-content">Thinking…</div>
                  </div>
                )}
              </div>

              <label className="agent-input-group">
                <span>Prompt</span>
                <textarea
                  data-testid={TEST_IDS.AGENT_PROMPT_INPUT}
                  className="agent-prompt-input"
                  placeholder="Ask the agent to plan or transform vault work..."
                  value={selectedSession.promptDraft}
                  onChange={(event) =>
                    updatePromptDraft(vaultPath, selectedSession.id, event.target.value)
                  }
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      void sendPrompt(vaultPath, selectedSession.id)
                    }
                  }}
                />
              </label>

              <div className="agent-actions">
                <button
                  className="toolbar-btn active"
                  data-testid={TEST_IDS.AGENT_SEND_PROMPT_BTN}
                  disabled={isRunning || selectedSession.promptDraft.trim().length === 0}
                  onClick={() => void sendPrompt(vaultPath, selectedSession.id)}
                >
                  {isRunning ? 'Running...' : 'Send'}
                </button>
                <span className="agent-hint">Cmd/Ctrl + Enter to send</span>
                {error && <span className="agent-error">{error}</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
