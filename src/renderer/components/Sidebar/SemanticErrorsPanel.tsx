import { TEST_IDS } from '../../lib/testids'
import { useSemanticErrorsStore } from '../../store/semantic-errors-store'
import { useEditorStore } from '../../store/editor-store'

const MAX_MESSAGE_LEN = 120

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

export function SemanticErrorsPanel() {
  const { errors, clearErrors } = useSemanticErrorsStore()
  const selectFile = useEditorStore((s) => s.selectFile)

  return (
    <div className="semantic-errors-panel" data-testid={TEST_IDS.SEMANTIC_ERRORS_PANEL}>
      <div className="sidebar-header semantic-errors-header">
        <span>Errors</span>
        <button
          className="semantic-errors-clear-btn"
          data-testid={TEST_IDS.SEMANTIC_ERRORS_CLEAR_BTN}
          onClick={clearErrors}
          title="Clear errors"
        >
          &times;
        </button>
      </div>
      <div className="semantic-errors-list">
        {errors.length === 0 ? (
          <div className="semantic-errors-empty">No errors</div>
        ) : (
          errors.map((error) => (
            <div
              key={error.id}
              className="semantic-error-entry"
              data-testid={TEST_IDS.SEMANTIC_ERROR_ENTRY}
              onClick={() => selectFile(error.file)}
            >
              <div className="semantic-error-file">{error.file}</div>
              <div>
                <span className="semantic-error-phase">{error.phase}</span>
                <span className="semantic-error-message">{truncate(error.message, MAX_MESSAGE_LEN)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
