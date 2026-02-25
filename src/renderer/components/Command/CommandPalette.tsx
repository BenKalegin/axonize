import { useState } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useRagStore } from '../../store/rag-store'
import { useVaultStore } from '../../store/vault-store'

export function CommandPalette() {
  const [value, setValue] = useState('')
  const { query, isQuerying, clearResponse } = useRagStore()
  const { vaultPath } = useVaultStore()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim() && vaultPath && !isQuerying) {
      e.preventDefault()
      query(vaultPath, value.trim())
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setValue('')
      clearResponse()
    }
  }

  return (
    <div className="command-palette" data-testid={TEST_IDS.COMMAND_PALETTE}>
      <input
        data-testid={TEST_IDS.COMMAND_INPUT}
        className={`command-input${isQuerying ? ' querying' : ''}`}
        placeholder="Ask a question about your docs... (Enter to search, Escape to clear)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
