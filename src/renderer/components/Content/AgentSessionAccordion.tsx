import { useCallback } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore, type AgentSession } from '@/store/agent-store'
import { AgentAccordionRow } from './AgentAccordionRow'
import { AgentPromptComposer } from './AgentPromptComposer'

interface AgentSessionAccordionProps {
  sessions: AgentSession[]
  vaultPath: string | null
  onRequestEnableEdits: (sessionId: string) => void
}

function AccordionTopbar({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="agent-accordion-topbar">
      <span className="agent-accordion-topbar-title">Sessions</span>
      <button
        className="agent-new-session-btn"
        data-testid={TEST_IDS.AGENT_NEW_SESSION_BTN}
        onClick={onCreate}
        title="New session"
      >
        +
      </button>
    </div>
  )
}

export function AgentSessionAccordion({ sessions, vaultPath, onRequestEnableEdits }: AgentSessionAccordionProps) {
  const selectedSessionId = useAgentStore((s) => s.selectedSessionId)
  const createSession = useAgentStore((s) => s.createSession)

  const activeSessionId = selectedSessionId ?? sessions[0]?.id ?? null

  const onCreate = useCallback(() => createSession(vaultPath), [createSession, vaultPath])

  return (
    <div className="agent-accordion-column">
      <AccordionTopbar onCreate={onCreate} />
      <div className="agent-accordion" data-testid={TEST_IDS.AGENT_ACCORDION}>
        {sessions.map((session) => (
          <AgentAccordionRow
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
            vaultPath={vaultPath}
            onRequestEnableEdits={onRequestEnableEdits}
          />
        ))}
      </div>
      {activeSessionId && <AgentPromptComposer sessionId={activeSessionId} vaultPath={vaultPath} />}
    </div>
  )
}
