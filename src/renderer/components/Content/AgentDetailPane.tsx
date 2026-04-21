import { useMemo } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore, type AgentSession, type AgentTurn } from '@/store/agent-store'
import { MarkdownContent } from './MarkdownContent'
import { CollapsibleTrace } from './CollapsibleTrace'

interface DetailPayload {
  session: AgentSession
  turn: AgentTurn
}

function EmptyDetail() {
  return (
    <div className="agent-detail-empty">
      <div className="agent-detail-empty-title">No turn selected</div>
      <div className="agent-detail-empty-sub">
        Click <strong>Show details</strong> on an analytical response in the left panel to expand it here.
      </div>
    </div>
  )
}

function DetailHeader({ session, turn, onClose }: { session: AgentSession; turn: AgentTurn; onClose: () => void }) {
  return (
    <div className="agent-detail-header">
      <div className="agent-detail-header-text">
        <span className="agent-detail-session-name">{session.name}</span>
        <span className="agent-detail-turn-time">
          {new Date(turn.createdAt).toLocaleString()}
        </span>
      </div>
      <button
        className="agent-detail-close"
        onClick={onClose}
        title="Close detail view"
      >
        ×
      </button>
    </div>
  )
}

export function AgentDetailPane() {
  const sessions = useAgentStore((s) => s.sessions)
  const selectedTurn = useAgentStore((s) => s.selectedTurn)
  const selectTurn = useAgentStore((s) => s.selectTurn)

  const payload = useMemo<DetailPayload | null>(() => {
    if (!selectedTurn) return null
    const session = sessions.find((s) => s.id === selectedTurn.sessionId)
    if (!session) return null
    const turn = session.turns.find((t) => t.id === selectedTurn.turnId)
    if (!turn) return null
    return { session, turn }
  }, [sessions, selectedTurn])

  return (
    <div className="agent-detail-pane" data-testid={TEST_IDS.AGENT_DETAIL_PANE}>
      {!payload ? (
        <EmptyDetail />
      ) : (
        <>
          <DetailHeader session={payload.session} turn={payload.turn} onClose={() => selectTurn(null)} />
          {payload.turn.toolTrace && <CollapsibleTrace lines={payload.turn.toolTrace} />}
          <div className="agent-detail-body">
            <MarkdownContent markdown={payload.turn.content} />
          </div>
          <div className="agent-detail-actions">
            <button className="toolbar-btn" disabled title="Coming soon">
              Save to docs…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
