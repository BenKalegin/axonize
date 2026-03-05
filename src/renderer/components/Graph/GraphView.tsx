import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { ForceGraph } from './ForceGraph'
import { useGraphStore } from '@/store/graph-store'
import type { VisibleDepth } from '@/store/graph-store'
import { useVaultStore } from '@/store/vault-store'
import type { SemanticProgress } from '@core/semantic/types'
import type { SemanticEstimateResult } from '../../../preload'

const PHASE_LABELS: Record<string, string> = {
  scanning: 'Scanning files',
  decomposing: 'Decomposing',
  'discovering-dimensions': 'Discovering dimensions',
  'facet-extraction': 'Extracting facets',
  clustering: 'Generating clusters',
  'cross-linking': 'Finding cross-doc relations',
  saving: 'Saving cache',
  'embedding-summaries': 'Embedding summaries'
}

const DEPTH_LABELS: { depth: VisibleDepth; label: string }[] = [
  { depth: -1, label: 'Clusters' },
  { depth: 0, label: 'Docs' },
  { depth: 1, label: 'Sections' },
  { depth: 2, label: 'Details' },
  { depth: 3, label: 'Chunks' }
]

function ProgressBar({ progress }: { progress: SemanticProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const label = PHASE_LABELS[progress.phase] ?? progress.phase
  const detail = progress.file ? `: ${progress.file}` : ''

  return (
    <div className="semantic-progress">
      <div className="semantic-progress-label">{label}{detail}</div>
      <div className="semantic-progress-track">
        <div className="semantic-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="semantic-progress-pct">{progress.current}/{progress.total}</div>
    </div>
  )
}

function formatCost(usd: number): string {
  if (usd === 0) return 'Free (local model)'
  if (usd < 0.01) return '< $0.01'
  return `~$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function EstimateCard({ estimate, onConfirm, onCancel }: {
  estimate: SemanticEstimateResult
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="semantic-estimate">
      <div className="semantic-estimate-title">Build Estimate</div>
      <div className="semantic-estimate-rows">
        <div className="semantic-estimate-row">
          <span>Files to process</span>
          <span>{estimate.filesToProcess} of {estimate.fileCount}</span>
        </div>
        {estimate.cachedFiles > 0 && (
          <div className="semantic-estimate-row semantic-estimate-row--muted">
            <span>Already cached</span>
            <span>{estimate.cachedFiles}</span>
          </div>
        )}
        <div className="semantic-estimate-row">
          <span>Estimated tokens</span>
          <span>{formatTokens(estimate.inputTokens + estimate.outputTokens)}</span>
        </div>
        <div className="semantic-estimate-row semantic-estimate-row--cost">
          <span>Estimated cost</span>
          <span>{formatCost(estimate.estimatedCostUsd)}</span>
        </div>
      </div>
      <div className="semantic-estimate-actions">
        <button className="graph-build-btn" onClick={onConfirm}>
          Build
        </button>
        <button className="semantic-estimate-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function DepthControls() {
  const { visibleDepth, setDepth } = useGraphStore()

  return (
    <div className="graph-depth-controls" data-testid={TEST_IDS.ZOOM_LEVEL}>
      {DEPTH_LABELS.map(({ depth, label }) => (
        <button
          key={depth}
          className={`graph-depth-btn${visibleDepth === depth ? ' graph-depth-btn--active' : ''}`}
          onClick={() => setDepth(depth)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function LensSelector() {
  const { activeLens, setLens, visibleDepth, dimensions } = useGraphStore()

  const lensOptions = useMemo(() => {
    const options = [{ key: 'by_topic', label: 'By Topic' }]
    for (const dim of dimensions) {
      options.push({ key: dim.key, label: dim.label })
    }
    return options
  }, [dimensions])

  if (visibleDepth > 0 || lensOptions.length < 2) return null

  return (
    <div className="graph-lens-selector">
      {lensOptions.map(({ key, label }) => (
        <button
          key={key}
          className={`graph-lens-btn${activeLens === key ? ' graph-lens-btn--active' : ''}`}
          onClick={() => setLens(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { cards, progress, increaseDepth, decreaseDepth, ensureLoaded, buildIndex, setProgress } = useGraphStore()
  const { vaultPath } = useVaultStore()
  const [estimate, setEstimate] = useState<SemanticEstimateResult | null>(null)
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    if (vaultPath) {
      ensureLoaded(vaultPath)
    }
  }, [vaultPath, ensureLoaded])

  useEffect(() => {
    return window.axonize.semantic.onProgress((payload: unknown) => {
      const p = payload as SemanticProgress
      setProgress(p.phase === 'done' ? null : p)
    })
  }, [setProgress])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      if (e.deltaY < 0) {
        increaseDepth()
      } else {
        decreaseDepth()
      }
    },
    [increaseDepth, decreaseDepth]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleEstimate = useCallback(async () => {
    if (!vaultPath) return
    setEstimating(true)
    try {
      const est = await window.axonize.semantic.estimate(vaultPath)
      setEstimate(est)
    } catch {
      buildIndex(vaultPath)
    }
    setEstimating(false)
  }, [vaultPath, buildIndex])

  const handleConfirmBuild = useCallback(() => {
    if (vaultPath) {
      setEstimate(null)
      buildIndex(vaultPath)
    }
  }, [vaultPath, buildIndex])

  const handleCancelBuild = useCallback(() => {
    setEstimate(null)
  }, [])

  const hasCards = cards.length > 0

  return (
    <div ref={containerRef} className="graph-view" data-testid={TEST_IDS.GRAPH_VIEW}>
      {hasCards && <DepthControls />}
      {hasCards && <LensSelector />}
      {progress && (
        <div className="graph-empty-state">
          <p>Building semantic index...</p>
          <ProgressBar progress={progress} />
        </div>
      )}
      {!progress && !hasCards && !estimate && (
        <div className="graph-empty-state graph-empty-state--interactive">
          <p>No semantic cards yet.</p>
          {vaultPath && (
            <button className="graph-build-btn" onClick={handleEstimate} disabled={estimating}>
              {estimating ? 'Estimating...' : 'Build Semantic Index'}
            </button>
          )}
        </div>
      )}
      {!progress && estimate && (
        <div className="graph-empty-state graph-empty-state--interactive">
          <EstimateCard
            estimate={estimate}
            onConfirm={handleConfirmBuild}
            onCancel={handleCancelBuild}
          />
        </div>
      )}
      {hasCards && <ForceGraph />}
    </div>
  )
}
