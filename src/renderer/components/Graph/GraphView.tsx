import { useCallback, useEffect, useRef, useState } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { ForceGraph } from './ForceGraph'
import { useGraphStore } from '../../store/graph-store'
import { useVaultStore } from '../../store/vault-store'
import type { SemanticProgress } from '../../../core/semantic/types'
import type { SemanticEstimateResult } from '../../../preload/index'

const PHASE_LABELS: Record<string, string> = {
  scanning: 'Scanning files',
  decomposing: 'Decomposing',
  'cross-linking': 'Finding cross-doc relations',
  saving: 'Saving cache'
}

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

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { zoomLevel, zoomIn, zoomOut, cards, isLoading, progress, ensureLoaded, buildIndex, setProgress } = useGraphStore()
  const { vaultPath } = useVaultStore()
  const [estimate, setEstimate] = useState<SemanticEstimateResult | null>(null)
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    if (vaultPath) {
      ensureLoaded(vaultPath)
    }
  }, [vaultPath, ensureLoaded])

  useEffect(() => {
    const unsub = window.axonize.semantic.onProgress((payload: unknown) => {
      const p = payload as SemanticProgress
      setProgress(p.phase === 'done' ? null : p)
    })
    return unsub
  }, [setProgress])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      if (e.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    },
    [zoomIn, zoomOut]
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
      // Fall through to build without estimate
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

  const displayLevel = zoomLevel.toFixed(1)
  const hasCards = cards.length > 0

  return (
    <div ref={containerRef} className="graph-view" data-testid={TEST_IDS.GRAPH_VIEW}>
      {hasCards && (
        <div className="graph-zoom-indicator" data-testid={TEST_IDS.ZOOM_LEVEL}>
          <button
            className="zoom-indicator-btn"
            onClick={zoomOut}
            data-testid={TEST_IDS.ZOOM_OUT_BTN}
          >
            -
          </button>
          <span className="zoom-indicator-label">L{displayLevel}</span>
          <button
            className="zoom-indicator-btn"
            onClick={zoomIn}
            data-testid={TEST_IDS.ZOOM_IN_BTN}
          >
            +
          </button>
        </div>
      )}
      {isLoading && (
        <div className="graph-empty-state">
          <p>Building semantic index...</p>
          {progress && <ProgressBar progress={progress} />}
        </div>
      )}
      {!isLoading && !hasCards && !estimate && (
        <div className="graph-empty-state graph-empty-state--interactive">
          <p>No semantic cards yet.</p>
          {vaultPath && (
            <button className="graph-build-btn" onClick={handleEstimate} disabled={estimating}>
              {estimating ? 'Estimating...' : 'Build Semantic Index'}
            </button>
          )}
        </div>
      )}
      {!isLoading && estimate && (
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
