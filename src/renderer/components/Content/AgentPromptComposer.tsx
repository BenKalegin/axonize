import { useCallback } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore } from '@/store/agent-store'
import { AgentClearSessionButton } from './AgentClearSessionButton'

interface AgentPromptComposerProps {
  sessionId: string
  vaultPath: string | null
  onRequestEnableEdits: (sessionId: string) => void
}

export function AgentPromptComposer({ sessionId, vaultPath, onRequestEnableEdits }: AgentPromptComposerProps) {
  const value = useAgentStore((s) => s.promptDrafts[sessionId] ?? '')
  const isRunning = useAgentStore((s) => s.runningSessionId === sessionId)
  const error = useAgentStore((s) => (s.runningSessionId === sessionId ? s.error : null))
  const allowEdits = useAgentStore((s) => s.sessions.find((x) => x.id === sessionId)?.allowEdits ?? false)
  const hasContent = useAgentStore((s) => {
    const session = s.sessions.find((x) => x.id === sessionId)
    return session ? session.turns.length > 0 || session.claudeSessionId !== undefined : false
  })
  const updatePromptDraft = useAgentStore((s) => s.updatePromptDraft)
  const sendPrompt = useAgentStore((s) => s.sendPrompt)
  const cancelPrompt = useAgentStore((s) => s.cancelPrompt)
  const setAllowEdits = useAgentStore((s) => s.setAllowEdits)
  const clearSession = useAgentStore((s) => s.clearSession)

  const canSend = !isRunning && value.trim().length > 0

  const onSend = useCallback(() => sendPrompt(vaultPath, sessionId), [sendPrompt, vaultPath, sessionId])
  const onCancel = useCallback(() => cancelPrompt(sessionId), [cancelPrompt, sessionId])
  const onChange = useCallback(
    (next: string) => updatePromptDraft(sessionId, next),
    [updatePromptDraft, sessionId]
  )
  const onToggleAllowEdits = useCallback(() => {
    if (allowEdits) setAllowEdits(vaultPath, sessionId, false)
    else onRequestEnableEdits(sessionId)
  }, [allowEdits, setAllowEdits, vaultPath, sessionId, onRequestEnableEdits])
  const onClear = useCallback(
    () => clearSession(vaultPath, sessionId),
    [clearSession, vaultPath, sessionId]
  )

  return (
    <div className="agent-composer">
      <textarea
        data-testid={TEST_IDS.AGENT_PROMPT_INPUT}
        className="agent-composer-input"
        placeholder="Ask about the vault or describe a change…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            canSend
          ) {
            event.preventDefault()
            onSend()
          }
        }}
      />
      <div className="agent-composer-footer">
        <button
          className={`agent-mode-pill${allowEdits ? ' enabled' : ''}`}
          onClick={onToggleAllowEdits}
          title={allowEdits ? 'Click to switch back to read-only' : 'Click to enable edits'}
        >
          {allowEdits ? '🔓 Edits enabled' : '🔒 Read-only'}
        </button>
        <AgentClearSessionButton hasContent={hasContent} onClear={onClear} />
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
