import { useMemo, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import {
  useEditorStore,
  isAgentTurnSelection
} from '@/store/editor-store'
import { useAgentStore } from '@/store/agent-store'
import { useVaultStore } from '@/store/vault-store'
import { sanitizeFilename, ensureMarkdownExt } from '@/lib/filename'
import { PromoteFileDialog } from '../Sidebar/PromoteFileDialog'

const AGENT_HISTORY_TITLE_MAX_CHARS = 40
const AGENT_RESPONSE_FALLBACK_NAME = 'agent-response'

function titleFromPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim()
  if (!normalized) return AGENT_RESPONSE_FALLBACK_NAME
  return normalized.length > AGENT_HISTORY_TITLE_MAX_CHARS
    ? normalized.slice(0, AGENT_HISTORY_TITLE_MAX_CHARS)
    : normalized
}

export function AgentTurnHeader() {
  const selection = useEditorStore((s) => s.selection)
  const sessions = useAgentStore((s) => s.sessions)
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const selectFile = useEditorStore((s) => s.selectFile)
  const [promoting, setPromoting] = useState(false)

  const ctx = useMemo(() => {
    if (!isAgentTurnSelection(selection)) return null
    const session = sessions.find((s) => s.id === selection.sessionId)
    if (!session) return null
    const turn = session.turns.find((t) => t.id === selection.turnId)
    if (!turn) return null
    return { session, turn, filePath: selection.filePath }
  }, [selection, sessions])

  if (!ctx) return null

  const defaultFilename = ensureMarkdownExt(
    sanitizeFilename(titleFromPrompt(ctx.session.name), AGENT_RESPONSE_FALLBACK_NAME)
  )

  const onPromoted = async (targetPath: string): Promise<void> => {
    if (!vaultPath) return
    await window.axonize.agentHistory.promote(ctx.filePath, targetPath)
    selectFile(targetPath)
  }

  return (
    <div className="agent-turn-header" data-testid={TEST_IDS.AGENT_TURN_HEADER}>
      <div className="agent-turn-header-text">
        <span className="agent-turn-header-session">{ctx.session.name}</span>
        <span className="agent-turn-header-time">{new Date(ctx.turn.createdAt).toLocaleString()}</span>
      </div>
      <button
        className="toolbar-btn agent-turn-header-action"
        data-testid={TEST_IDS.AGENT_TURN_PROMOTE_BTN}
        onClick={() => setPromoting(true)}
      >
        Save to docs…
      </button>
      {promoting && (
        <PromoteFileDialog
          defaultFilename={defaultFilename}
          dialogTitle="Save to docs"
          confirmLabel="Save"
          onPromote={onPromoted}
          onClose={() => setPromoting(false)}
        />
      )}
    </div>
  )
}
