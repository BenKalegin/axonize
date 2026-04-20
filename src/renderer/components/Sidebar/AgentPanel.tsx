import { useEffect, useMemo, useRef, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore, type AgentSession } from '@/store/agent-store'
import { useVaultStore } from '@/store/vault-store'
import { renderMarkdown } from '@/lib/markdown-renderer'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AgentPanel() {
  const vaultPath = useVaultStore((state) => state.vaultPath)
  const {
    sessions,
    selectedSessionId,
    runningSessionId,
    streamingText,
    toolTrace,
    error,
    hydrate,
    createSession,
    deleteSession,
    selectSession,
    setAllowEdits,
    updatePromptDraft,
    sendPrompt,
    cancelPrompt,
    handleEvent
  } = useAgentStore()

  const [enableEditsTarget, setEnableEditsTarget] = useState<string | null>(null)

  useEffect(() => {
    hydrate(vaultPath)
  }, [hydrate, vaultPath])

  useEffect(() => {
    return window.axonize.agent.onEvent((payload) => handleEvent(vaultPath, payload))
  }, [handleEvent, vaultPath])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const isRunning = selectedSession ? runningSessionId === selectedSession.id : false

  const onModePillClick = () => {
    if (!selectedSession) return
    if (selectedSession.allowEdits) {
      setAllowEdits(vaultPath, selectedSession.id, false)
      return
    }
    setEnableEditsTarget(selectedSession.id)
  }

  const onConfirmEnableEdits = () => {
    if (enableEditsTarget) {
      setAllowEdits(vaultPath, enableEditsTarget, true)
    }
    setEnableEditsTarget(null)
  }

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
            <SessionItem
              key={session.id}
              session={session}
              active={session.id === selectedSessionId}
              onSelect={() => selectSession(session.id)}
              onDelete={() => deleteSession(vaultPath, session.id)}
            />
          ))}
        </aside>

        <section className="agent-workspace">
          {!selectedSession ? (
            <div className="agent-empty-state">No session selected.</div>
          ) : (
            <AgentConversation
              session={selectedSession}
              isRunning={isRunning}
              streamingText={streamingText}
              toolTrace={toolTrace}
              error={error}
              onModePillClick={onModePillClick}
              onPromptChange={(value) => updatePromptDraft(vaultPath, selectedSession.id, value)}
              onSend={() => sendPrompt(vaultPath, selectedSession.id)}
              onCancel={() => cancelPrompt(selectedSession.id)}
            />
          )}
        </section>
      </div>

      {enableEditsTarget && (
        <EnableEditsConfirm
          onConfirm={onConfirmEnableEdits}
          onCancel={() => setEnableEditsTarget(null)}
        />
      )}
    </div>
  )
}

interface SessionItemProps {
  session: AgentSession
  active: boolean
  onSelect: () => void
  onDelete: () => void
}

function SessionItem({ session, active, onSelect, onDelete }: SessionItemProps) {
  return (
    <button
      className={`agent-session-item${active ? ' active' : ''}`}
      data-testid={TEST_IDS.AGENT_SESSION_ITEM}
      onClick={onSelect}
    >
      <div className="agent-session-main">
        <span className="agent-session-name">{session.name}</span>
        <span className="agent-session-time">{formatTime(session.updatedAt)}</span>
      </div>
      <div className="agent-session-meta">
        {session.messages.length} msg
        {session.allowEdits ? ' · edits' : ''}
      </div>
      <span
        className="agent-delete-session-btn"
        data-testid={TEST_IDS.AGENT_DELETE_SESSION_BTN}
        title="Delete session"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDelete()
        }}
      >
        ×
      </span>
    </button>
  )
}

interface AgentConversationProps {
  session: AgentSession
  isRunning: boolean
  streamingText: string
  toolTrace: string[]
  error: string | null
  onModePillClick: () => void
  onPromptChange: (value: string) => void
  onSend: () => void
  onCancel: () => void
}

function AgentConversation({
  session, isRunning, streamingText, toolTrace, error,
  onModePillClick, onPromptChange, onSend, onCancel
}: AgentConversationProps) {
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = threadRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [session.id, session.messages.length, isRunning, streamingText, toolTrace.length])

  return (
    <>
      <div className="agent-session-header">
        <span className="agent-session-title">{session.name}</span>
        <button
          className={`agent-mode-pill${session.allowEdits ? ' enabled' : ''}`}
          onClick={onModePillClick}
          title={session.allowEdits ? 'Click to switch back to read-only' : 'Click to enable edits'}
        >
          {session.allowEdits ? '🔓 Edits enabled' : '🔒 Read-only'}
        </button>
      </div>

      <div ref={threadRef} className="agent-thread">
        {session.messages.length === 0 && !isRunning ? (
          <div className="agent-empty-intro">
            <div className="agent-empty-title">Axonize Agent</div>
            <div className="agent-empty-sub">
              Ask questions about the vault, or describe a change. Enable edits (top right) to let me Write / Edit files.
            </div>
          </div>
        ) : (
          session.messages.map((message) => (
            <AgentMessageView key={message.id} message={message} />
          ))
        )}
        {isRunning && <StreamingBubble streamingText={streamingText} toolTrace={toolTrace} />}
      </div>

      <PromptComposer
        value={session.promptDraft}
        isRunning={isRunning}
        error={error}
        onChange={onPromptChange}
        onSend={onSend}
        onCancel={onCancel}
      />
    </>
  )
}

interface AgentMessageViewProps {
  message: AgentSession['messages'][number]
}

function AgentMessageView({ message }: AgentMessageViewProps) {
  return (
    <div
      className={`agent-message agent-message--${message.role}`}
      data-testid={TEST_IDS.AGENT_MESSAGE}
    >
      <div className="agent-message-role">{message.role === 'user' ? 'You' : 'Agent'}</div>
      {message.toolTrace && message.toolTrace.length > 0 && (
        <CollapsibleTrace lines={message.toolTrace} />
      )}
      {message.role === 'assistant' ? (
        <MarkdownContent markdown={message.content} />
      ) : (
        <div className="agent-message-content">{message.content}</div>
      )}
    </div>
  )
}

interface MarkdownContentProps {
  markdown: string
}

function MarkdownContent({ markdown }: MarkdownContentProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    renderMarkdown(markdown).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => { cancelled = true }
  }, [markdown])

  return (
    <div
      className="agent-message-content markdown-view"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

interface CollapsibleTraceProps {
  lines: string[]
}

function CollapsibleTrace({ lines }: CollapsibleTraceProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`agent-tool-trace${open ? ' open' : ''}`}>
      <button className="agent-tool-trace-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? '▾' : '▸'} {lines.length} tool call{lines.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div className="agent-tool-trace-body">
          {lines.map((line, idx) => (
            <div key={idx} className="agent-tool-trace-line">{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}

interface StreamingBubbleProps {
  streamingText: string
  toolTrace: string[]
}

function StreamingBubble({ streamingText, toolTrace }: StreamingBubbleProps) {
  const lastTool = toolTrace[toolTrace.length - 1]
  const hasText = streamingText.length > 0

  return (
    <div className="agent-message agent-message--assistant agent-message--pending" data-testid={TEST_IDS.AGENT_MESSAGE}>
      <div className="agent-message-role">Agent</div>
      {toolTrace.length > 0 && <CollapsibleTrace lines={toolTrace} />}
      <div className="agent-message-content">
        {hasText ? streamingText : (lastTool ? lastTool : 'Thinking…')}
      </div>
    </div>
  )
}

interface PromptComposerProps {
  value: string
  isRunning: boolean
  error: string | null
  onChange: (value: string) => void
  onSend: () => void
  onCancel: () => void
}

function PromptComposer({ value, isRunning, error, onChange, onSend, onCancel }: PromptComposerProps) {
  const canSend = !isRunning && value.trim().length > 0
  return (
    <div className="agent-composer">
      <textarea
        data-testid={TEST_IDS.AGENT_PROMPT_INPUT}
        className="agent-composer-input"
        placeholder="Ask about the vault or describe a change…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canSend) {
            event.preventDefault()
            onSend()
          }
        }}
      />
      <div className="agent-composer-footer">
        <span className="agent-hint">Cmd/Ctrl + Enter to send</span>
        {error && <span className="agent-error">{error}</span>}
        {isRunning ? (
          <button className="toolbar-btn" onClick={onCancel}>Stop</button>
        ) : (
          <button
            className="toolbar-btn active"
            data-testid={TEST_IDS.AGENT_SEND_PROMPT_BTN}
            disabled={!canSend}
            onClick={onSend}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}

interface EnableEditsConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

function EnableEditsConfirm({ onConfirm, onCancel }: EnableEditsConfirmProps) {
  return (
    <div className="agent-confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="agent-confirm-dialog">
        <div className="agent-confirm-title">Allow edits for this session?</div>
        <div className="agent-confirm-body">
          The agent will be able to Write, Edit, MultiEdit, and run Bash commands inside the vault. This can modify or delete files.
        </div>
        <div className="agent-confirm-actions">
          <button className="toolbar-btn" onClick={onCancel}>Cancel</button>
          <button className="toolbar-btn active" onClick={onConfirm}>Allow edits</button>
        </div>
      </div>
    </div>
  )
}
