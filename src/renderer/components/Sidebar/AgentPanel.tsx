import { useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useAgentStore } from '@/store/agent-store'
import { useVaultStore } from '@/store/vault-store'
import { AgentSessionAccordion } from '../Content/AgentSessionAccordion'
import { EnableEditsConfirm } from '../Content/EnableEditsConfirm'

export function AgentPanel() {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const sessions = useAgentStore((s) => s.sessions)
  const setAllowEdits = useAgentStore((s) => s.setAllowEdits)

  const [enableEditsTarget, setEnableEditsTarget] = useState<string | null>(null)

  const onConfirmEnableEdits = () => {
    if (enableEditsTarget) {
      setAllowEdits(vaultPath, enableEditsTarget, true)
    }
    setEnableEditsTarget(null)
  }

  return (
    <div className="agent-panel" data-testid={TEST_IDS.AGENT_PANEL}>
      <AgentSessionAccordion
        sessions={sessions}
        vaultPath={vaultPath}
        onRequestEnableEdits={setEnableEditsTarget}
      />
      {enableEditsTarget && (
        <EnableEditsConfirm
          onConfirm={onConfirmEnableEdits}
          onCancel={() => setEnableEditsTarget(null)}
        />
      )}
    </div>
  )
}
