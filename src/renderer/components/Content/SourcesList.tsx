import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { useVaultStore } from '../../store/vault-store'

interface Source {
  filePath: string
  startLine: number
  headingPath: string[]
  score: number
  contentPreview: string
}

interface SourcesListProps {
  sources: Source[]
  onNavigate?: () => void
}

export function SourcesList({ sources, onNavigate }: SourcesListProps) {
  const { selectFile } = useEditorStore()
  const { vaultPath } = useVaultStore()

  const handleClick = (filePath: string) => {
    const fullPath = filePath.startsWith('/') ? filePath : `${vaultPath}/${filePath}`
    selectFile(fullPath)
    onNavigate?.()
  }

  return (
    <div className="rag-answer-sources">
      <h4 className="rag-sources-heading">Sources</h4>
      {sources.map((source, i) => {
        const label = source.headingPath.length > 0
          ? `${source.filePath} > ${source.headingPath.join(' > ')}`
          : source.filePath
        return (
          <button
            key={`${source.filePath}:${source.startLine}:${i}`}
            className="rag-source-link"
            data-testid={TEST_IDS.RAG_SOURCE_LINK}
            onClick={() => handleClick(source.filePath)}
          >
            <span className="source-label">{label}</span>
            <span className="source-score">{(source.score * 100).toFixed(1)}%</span>
          </button>
        )
      })}
    </div>
  )
}
