import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { useVaultStore } from '../../store/vault-store'
import { useRagStore } from '../../store/rag-store'
import { MarkdownView } from './MarkdownView'
import { RAGAnswerView } from './RAGAnswerView'
import { GraphView } from '../Graph/GraphView'
import { WelcomeScreen } from './WelcomeScreen'

export function ContentView() {
  const { viewMode, selectedFile } = useEditorStore()
  const { vaultPath } = useVaultStore()
  const { lastResponse, isQuerying } = useRagStore()

  return (
    <div className="content-view" data-testid={TEST_IDS.CONTENT_VIEW}>
      {!vaultPath ? (
        <WelcomeScreen />
      ) : lastResponse || isQuerying ? (
        isQuerying ? (
          <div className="empty-state" data-testid={TEST_IDS.EMPTY_STATE}>
            <p>Querying...</p>
          </div>
        ) : (
          <RAGAnswerView />
        )
      ) : viewMode === 'graph' ? (
        <GraphView />
      ) : selectedFile ? (
        <MarkdownView />
      ) : (
        <div className="empty-state" data-testid={TEST_IDS.EMPTY_STATE}>
          <p>Select a file to view</p>
        </div>
      )}
    </div>
  )
}
