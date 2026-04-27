import { useGraphStore } from '@/store/graph-store'
import { useRagStore } from '@/store/rag-store'
import type { SemanticProgress } from '@core/semantic/types'
import type { IndexProgress } from '@core/rag/types'

interface ActiveJob {
  key: string
  label: string
  detail: string
}

const RAG_PHASE_LABELS: Record<IndexProgress['phase'], string> = {
  scanning: 'scanning',
  extracting: 'extracting',
  embedding: 'embedding',
  saving: 'saving',
  done: 'done'
}

const SEMANTIC_PHASE_LABELS: Record<SemanticProgress['phase'], string> = {
  scanning: 'scanning',
  decomposing: 'decomposing',
  'discovering-dimensions': 'analyzing dimensions',
  'facet-extraction': 'extracting facets',
  clustering: 'clustering',
  'cross-linking': 'linking',
  saving: 'saving',
  'embedding-summaries': 'embedding summaries',
  done: 'done'
}

function formatCount(current: number, total: number): string {
  return total > 0 ? ` ${current}/${total}` : ''
}

function ragJob(progress: IndexProgress | null, isIndexing: boolean): ActiveJob | null {
  if (!isIndexing && !progress) return null
  if (progress && progress.phase === 'done') return null
  const phase = progress ? RAG_PHASE_LABELS[progress.phase] : 'preparing'
  const count = progress ? formatCount(progress.current, progress.total) : ''
  return { key: 'rag', label: 'RAG index', detail: `${phase}${count}` }
}

function semanticJob(progress: SemanticProgress | null): ActiveJob | null {
  if (!progress || progress.phase === 'done') return null
  return {
    key: 'semantic',
    label: 'Semantic index',
    detail: `${SEMANTIC_PHASE_LABELS[progress.phase]}${formatCount(progress.current, progress.total)}`
  }
}

function queryJob(isQuerying: boolean): ActiveJob | null {
  return isQuerying ? { key: 'query', label: 'RAG query', detail: 'running' } : null
}

function collectJobs(
  semantic: SemanticProgress | null,
  rag: IndexProgress | null,
  isIndexing: boolean,
  isQuerying: boolean
): ActiveJob[] {
  return [ragJob(rag, isIndexing), semanticJob(semantic), queryJob(isQuerying)].filter(
    (j): j is ActiveJob => j !== null
  )
}

export function JobStatusIndicator() {
  const semanticProgress = useGraphStore((s) => s.progress)
  const ragProgress = useRagStore((s) => s.indexProgress)
  const isIndexing = useRagStore((s) => s.isIndexing)
  const isQuerying = useRagStore((s) => s.isQuerying)

  const jobs = collectJobs(semanticProgress, ragProgress, isIndexing, isQuerying)
  if (jobs.length === 0) return null

  return (
    <div className="job-status-indicator" data-testid="job-status-indicator">
      {jobs.map((job) => (
        <span key={job.key} className="job-status-item" title={`${job.label}: ${job.detail}`}>
          <span className="job-status-spinner" aria-hidden="true" />
          <span className="job-status-label">{job.label}</span>
          <span className="job-status-detail">{job.detail}</span>
        </span>
      ))}
    </div>
  )
}
