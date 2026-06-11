import { useEffect, useState } from 'react'
import {
  diffLines,
  diffStats,
  collapseContext,
  type DiffSegment
} from '@core/prose/line-diff'
import { renderMarkdown } from '@/lib/markdown-renderer'
import { useProseStore, RefactorPhase } from '@/store/prose-store'

interface RenderedSegment {
  kind: DiffSegment['kind']
  html: string
}

// A dropped context run rendered as a gap separator.
type DisplayRow = RenderedSegment | 'gap'

async function renderSegments(segments: (DiffSegment | null)[]): Promise<DisplayRow[]> {
  return Promise.all(
    segments.map(async (seg) => {
      if (seg === null) return 'gap' as const
      return { kind: seg.kind, html: await renderMarkdown(seg.lines.join('\n')) }
    })
  )
}

export function RefactorReviewDialog() {
  const { phase, filePath, original, refactored, apply, discard } = useProseStore()
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [stats, setStats] = useState({ added: 0, removed: 0 })

  const inReview = phase === RefactorPhase.review || phase === RefactorPhase.applying

  useEffect(() => {
    if (!inReview || original === null || refactored === null) {
      setRows([])
      return
    }
    let cancelled = false
    const segments = diffLines(original, refactored)
    setStats(diffStats(segments))
    renderSegments(collapseContext(segments)).then((rendered) => {
      if (!cancelled) setRows(rendered)
    })
    return () => { cancelled = true }
  }, [inReview, original, refactored])

  useEffect(() => {
    if (!inReview) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') discard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inReview, discard])

  if (!inReview) return null

  const fileName = filePath?.split('/').pop() ?? ''
  const applying = phase === RefactorPhase.applying

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) discard() }}>
      <div className="settings-dialog refactor-review-dialog" role="dialog" aria-modal="true">
        <div className="settings-header">
          <span>Refactor review — {fileName}</span>
          <span className="refactor-review-stats">
            <span className="refactor-stat refactor-stat--added">+{stats.added}</span>
            <span className="refactor-stat refactor-stat--removed">−{stats.removed}</span>
          </span>
        </div>
        <div className="settings-body refactor-review-body">
          <div className="diff-view">
            {rows.map((row, i) =>
              row === 'gap' ? (
                <div key={i} className="refactor-diff-gap">⋯</div>
              ) : (
                <div
                  key={i}
                  className={`diff-group diff-group--${row.kind}`}
                  dangerouslySetInnerHTML={{ __html: row.html }}
                />
              )
            )}
          </div>
        </div>
        <div className="settings-footer">
          <button className="toolbar-btn" onClick={discard} disabled={applying}>Discard</button>
          <button className="toolbar-btn active" onClick={apply} disabled={applying}>
            {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
