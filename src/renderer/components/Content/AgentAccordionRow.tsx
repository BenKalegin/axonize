import { useCallback, useEffect, useRef } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore, type AgentSession, type AgentTurn } from '@/store/agent-store'
import { useEditorStore, isAgentTurnSelection } from '@/store/editor-store'
import { AgentTurnRole } from '@core/agent/turn-kinds'
import { AgentTurnItem, scrollAgentTurnIntoView } from './AgentTurnItem'
import { CollapsibleTrace } from './CollapsibleTrace'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface AgentAccordionRowProps {
  session: AgentSession
  active: boolean
  vaultPath: string | null
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

export function AgentAccordionRow({ session, active, vaultPath }: AgentAccordionRowProps) {
  const selection = useEditorStore((s) => s.selection)
  const selectAgentTurn = useEditorStore((s) => s.selectAgentTurn)
  const selectSession = useAgentStore((s) => s.selectSession)
  const deleteSession = useAgentStore((s) => s.deleteSession)
  const toggleSessionCollapsed = useAgentStore((s) => s.toggleSessionCollapsed)

  const lastUserTurnId = session.turns.findLast((t) => t.role === AgentTurnRole.User)?.id ?? null
  const seenUserTurnIdRef = useRef<string | null>(lastUserTurnId)
  useEffect(() => {
    if (lastUserTurnId === seenUserTurnIdRef.current) return
    seenUserTurnIdRef.current = lastUserTurnId
    if (lastUserTurnId) scrollAgentTurnIntoView(lastUserTurnId)
  }, [lastUserTurnId])

  const onActivate = useCallback(() => selectSession(session.id), [selectSession, session.id])
  const onToggleCollapsed = useCallback(
    () => toggleSessionCollapsed(vaultPath, session.id),
    [toggleSessionCollapsed, vaultPath, session.id]
  )
  const onDelete = useCallback(
    () => deleteSession(vaultPath, session.id),
    [deleteSession, vaultPath, session.id]
  )

  const selectedTurnId = isAgentTurnSelection(selection) && selection.sessionId === session.id
    ? selection.turnId
    : null

  const showTurn = (turn: AgentTurn): void => {
    if (!turn.filePath) return
    selectAgentTurn({ sessionId: session.id, turnId: turn.id, filePath: turn.filePath })
  }

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
          {session.turns.length === 0 ? (
            <EmptyIntro />
          ) : (
            session.turns.map((turn) => (
              <AgentTurnItem
                key={turn.id}
                turn={turn}
                selected={selectedTurnId === turn.id}
                onShowDetails={() => showTurn(turn)}
              />
            ))
          )}
          <StreamingTurn sessionId={session.id} />
        </div>
      )}
    </div>
  )
}
