import { useEffect, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'

const CLEAR_CONFIRM_TIMEOUT_MS = 4000

interface AgentClearSessionButtonProps {
  hasContent: boolean
  onClear: () => void
}

export function AgentClearSessionButton({ hasContent, onClear }: AgentClearSessionButtonProps) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const id = window.setTimeout(() => setConfirming(false), CLEAR_CONFIRM_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [confirming])

  if (confirming) {
    return (
      <button
        className="agent-clear-session-btn confirming"
        data-testid={TEST_IDS.AGENT_CLEAR_SESSION_CONFIRM_BTN}
        onClick={(e) => {
          e.stopPropagation()
          setConfirming(false)
          onClear()
        }}
        onBlur={() => setConfirming(false)}
        autoFocus
        title="Click to confirm — clears chat, agent context, and history files"
      >
        Confirm clear?
      </button>
    )
  }

  return (
    <button
      className="agent-clear-session-btn"
      data-testid={TEST_IDS.AGENT_CLEAR_SESSION_BTN}
      onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
      disabled={!hasContent}
      title="Clear chat, agent context, and history files"
    >
      ⌫ Clear
    </button>
  )
}
