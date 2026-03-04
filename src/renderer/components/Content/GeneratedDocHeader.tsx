import { TEST_IDS } from '../../lib/testids'
import type { GeneratedDocMeta } from '../../../core/rag/types'

interface GeneratedDocHeaderProps {
  doc: GeneratedDocMeta
  onMakePermanent: () => void
}

export function GeneratedDocHeader({ doc, onMakePermanent }: GeneratedDocHeaderProps) {
  return (
    <div className="generated-doc-header" data-testid={TEST_IDS.GENERATED_DOC_HEADER}>
      <span className="generated-doc-header-title">{doc.title}</span>
      <span className="generated-doc-header-query">&ldquo;{doc.query}&rdquo;</span>
      <button
        className="toolbar-btn generated-doc-header-action"
        data-testid={TEST_IDS.GENERATED_DOC_PERMANENT_BTN}
        onClick={onMakePermanent}
      >
        Make Permanent
      </button>
    </div>
  )
}
