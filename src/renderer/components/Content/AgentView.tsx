import { TEST_IDS } from '@/lib/testids'
import { AgentDetailPane } from './AgentDetailPane'

export function AgentView() {
  return (
    <div className="agent-view" data-testid={TEST_IDS.AGENT_VIEW}>
      <AgentDetailPane />
    </div>
  )
}
