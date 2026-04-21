import { useCallback } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore, type AgentSession } from '@/store/agent-store'
import { AgentTurnItem } from './AgentTurnItem'
import { CollapsibleTrace } from './CollapsibleTrace'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface AgentAccordionRowProps {
  session: AgentSession
  active: boolean
  vaultPath: string | null
  onRequestEnableEdits: (sessionId: string) => void
}

interface RowHeaderProps {
  session: AgentSession
  active: boolean
  onActivate: () => void
  onToggleCollapsed: () => void
  onDelete: () => void
}

function RowHeader({ session, active, onActivate, onToggleCollapsed, onDelete }: RowHeaderProps) {
  const chevron = session.collapsed ? '▸' : '▾'
  return (
    <div
      className={`agent-accordion-header${active ? ' active' : ''}`}
      data-testid={TEST_IDS.AGENT_SESSION_ITEM}
      onClick={onActivate}
    >
      <button
        className="agent-accordion-chevron"
        data-testid={TEST_IDS.AGENT_SESSION_TOGGLE}
        onClick={(e) => { e.stopPropagation(); onToggleCollapsed() }}
        title={session.collapsed ? 'Expand' : 'Collapse'}
      >
        {chevron}
      </button>
      <span className="agent-accordion-title">{session.name}</span>
      <span className="agent-accordion-meta">
        {session.turns.length} turn{session.turns.length === 1 ? '' : 's'}
        {session.allowEdits ? ' · edits' : ''}
        <span className="agent-accordion-time"> · {formatTime(session.updatedAt)}</span>
      </span>
      <button
        className="agent-delete-session-btn"
        data-testid={TEST_IDS.AGENT_DELETE_SESSION_BTN}
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Delete session"
      >
        ×
      </button>
    </div>
  )
}

function EmptyIntro() {
  return (
    <div className="agent-empty-intro">
      <div className="agent-empty-title">Axonize Agent</div>
      <div className="agent-empty-sub">
        Ask about the vault, or describe a change. Enable edits to allow Write / Edit / Bash.
      </div>
    </div>
  )
}

const THINKING_PLACEHOLDER = 'Thinking…'

function StreamingTurn({ sessionId }: { sessionId: string }) {
  const text = useAgentStore((s) => (s.runningSessionId === sessionId ? s.streamingText : ''))
  const toolTrace = useAgentStore((s) => (s.runningSessionId === sessionId ? s.toolTrace : null))
  if (toolTrace === null) return null

  const lastTool = toolTrace[toolTrace.length - 1]
  const body = text.length > 0 ? text : (lastTool ?? THINKING_PLACEHOLDER)
  return (
    <div className="agent-turn agent-turn--assistant agent-turn--pending" data-testid={TEST_IDS.AGENT_TURN}>
      <div className="agent-turn-role">Agent</div>
      <CollapsibleTrace lines={toolTrace} />
      <div className="agent-turn-content">{body}</div>
    </div>
  )
}

export function AgentAccordionRow({ session, active, vaultPath, onRequestEnableEdits }: AgentAccordionRowProps) {
  const selectedTurn = useAgentStore((s) => s.selectedTurn)
  const selectSession = useAgentStore((s) => s.selectSession)
  const selectTurn = useAgentStore((s) => s.selectTurn)
  const deleteSession = useAgentStore((s) => s.deleteSession)
  const toggleSessionCollapsed = useAgentStore((s) => s.toggleSessionCollapsed)
  const setAllowEdits = useAgentStore((s) => s.setAllowEdits)

  const onActivate = useCallback(() => selectSession(session.id), [selectSession, session.id])
  const onToggleCollapsed = useCallback(
    () => toggleSessionCollapsed(vaultPath, session.id),
    [toggleSessionCollapsed, vaultPath, session.id]
  )
  const onDelete = useCallback(
    () => deleteSession(vaultPath, session.id),
    [deleteSession, vaultPath, session.id]
  )
  const onToggleAllowEdits = useCallback(() => {
    if (session.allowEdits) {
      setAllowEdits(vaultPath, session.id, false)
    } else {
      onRequestEnableEdits(session.id)
    }
  }, [session.allowEdits, session.id, setAllowEdits, vaultPath, onRequestEnableEdits])

  const selectedTurnId = selectedTurn?.sessionId === session.id ? selectedTurn.turnId : null

  return (
    <div className={`agent-accordion-row${active ? ' active' : ''}`}>
      <RowHeader
        session={session}
        active={active}
        onActivate={onActivate}
        onToggleCollapsed={onToggleCollapsed}
        onDelete={onDelete}
      />
      {!session.collapsed && (
        <div className="agent-accordion-body">
          <div className="agent-accordion-body-header">
            <button
              className={`agent-mode-pill${session.allowEdits ? ' enabled' : ''}`}
              onClick={onToggleAllowEdits}
              title={session.allowEdits ? 'Click to switch back to read-only' : 'Click to enable edits'}
            >
              {session.allowEdits ? '🔓 Edits enabled' : '🔒 Read-only'}
            </button>
          </div>
          {session.turns.length === 0 ? (
            <EmptyIntro />
          ) : (
            session.turns.map((turn) => (
              <AgentTurnItem
                key={turn.id}
                turn={turn}
                selected={selectedTurnId === turn.id}
                onShowDetails={() => selectTurn({ sessionId: session.id, turnId: turn.id })}
              />
            ))
          )}
          <StreamingTurn sessionId={session.id} />
        </div>
      )}
    </div>
  )
}
