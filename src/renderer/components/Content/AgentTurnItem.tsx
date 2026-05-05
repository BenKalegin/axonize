import { TEST_IDS } from '@/lib/testids'
import { AgentTurnKind, AgentTurnRole } from '@core/agent/turn-kinds'
import type { AgentTurn } from '@/store/agent-store'
import { MarkdownContent } from './MarkdownContent'
import { CollapsibleTrace } from './CollapsibleTrace'

const TURN_INDENT_PX = 16

const AGENT_TURN_DOM_ID_PREFIX = 'agent-turn-'

export function scrollAgentTurnIntoView(turnId: string): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(`${AGENT_TURN_DOM_ID_PREFIX}${turnId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

interface AgentTurnItemProps {
  turn: AgentTurn
  selected: boolean
  onShowDetails: () => void
}

function AssistantTurnBody({ turn, selected, onShowDetails }: AgentTurnItemProps) {
  if (turn.kind === AgentTurnKind.Analytical) {
    return (
      <div className="agent-turn-analytical">
        <MarkdownContent markdown={turn.preview ?? ''} className="agent-turn-preview" />
        <button
          data-testid={TEST_IDS.AGENT_SHOW_DETAILS_BTN}
          className={`agent-show-details-btn${selected ? ' selected' : ''}`}
          onClick={onShowDetails}
        >
          {selected ? '▸ Shown in detail pane' : 'Show details →'}
        </button>
      </div>
    )
  }
  return <MarkdownContent markdown={turn.content ?? turn.preview ?? ''} className="agent-turn-content" />
}

export function AgentTurnItem(props: AgentTurnItemProps) {
  const { turn } = props
  const depth = turn.parentTurnId ? 1 : 0
  const isUser = turn.role === AgentTurnRole.User
  return (
    <div
      id={`${AGENT_TURN_DOM_ID_PREFIX}${turn.id}`}
      className={`agent-turn agent-turn--${turn.role}`}
      data-testid={TEST_IDS.AGENT_TURN}
      style={{ marginLeft: depth * TURN_INDENT_PX }}
    >
      <div className="agent-turn-role">{isUser ? 'You' : 'Agent'}</div>
      {!isUser && turn.toolTrace && <CollapsibleTrace lines={turn.toolTrace} />}
      {isUser
        ? <div className="agent-turn-content">{turn.content ?? ''}</div>
        : <AssistantTurnBody {...props} />}
    </div>
  )
}
