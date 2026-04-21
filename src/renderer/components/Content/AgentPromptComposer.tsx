import { useCallback } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore } from '@/store/agent-store'

interface AgentPromptComposerProps {
  sessionId: string
  vaultPath: string | null
}

export function AgentPromptComposer({ sessionId, vaultPath }: AgentPromptComposerProps) {
  const value = useAgentStore((s) => s.promptDrafts[sessionId] ?? '')
  const isRunning = useAgentStore((s) => s.runningSessionId === sessionId)
  const error = useAgentStore((s) => (s.runningSessionId === sessionId ? s.error : null))
  const updatePromptDraft = useAgentStore((s) => s.updatePromptDraft)
  const sendPrompt = useAgentStore((s) => s.sendPrompt)
  const cancelPrompt = useAgentStore((s) => s.cancelPrompt)

  const canSend = !isRunning && value.trim().length > 0

  const onSend = useCallback(() => sendPrompt(vaultPath, sessionId), [sendPrompt, vaultPath, sessionId])
  const onCancel = useCallback(() => cancelPrompt(sessionId), [cancelPrompt, sessionId])
  const onChange = useCallback(
    (next: string) => updatePromptDraft(sessionId, next),
    [updatePromptDraft, sessionId]
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
