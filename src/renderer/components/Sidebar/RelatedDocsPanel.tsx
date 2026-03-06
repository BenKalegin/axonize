import { useCallback, useEffect, useRef, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { useLayoutStore } from '@/store/layout-store'
import type { RelatedDoc } from '../../../preload/index'

const SUMMARY_MAX_LENGTH = 80
const SCORE_PERCENTAGE = 100

function truncateSummary(text: string): string {
  if (text.length <= SUMMARY_MAX_LENGTH) return text
  return text.slice(0, SUMMARY_MAX_LENGTH) + '...'
}

function formatScore(score: number): string {
  return Math.round(score * SCORE_PERCENTAGE) + '%'
}

function toRelativePath(filePath: string, vaultPath: string): string {
  if (filePath.startsWith(vaultPath)) {
    const stripped = filePath.slice(vaultPath.length)
    return stripped.startsWith('/') ? stripped.slice(1) : stripped
  }
  return filePath
}

function useRelatedDocs(selectedFile: string | null, vaultPath: string | null) {
  const [docs, setDocs] = useState<RelatedDoc[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedFile || !vaultPath) {
      setDocs([])
      return
    }

    let cancelled = false
    const relativePath = toRelativePath(selectedFile, vaultPath)

    setLoading(true)
    console.log('[RelatedDocs] fetching for:', relativePath, 'vault:', vaultPath)
    window.axonize.semantic
      .relatedDocs(vaultPath, relativePath)
      .then((result) => {
        if (!cancelled) setDocs(result)
      })
      .catch((err) => {
        console.error('[RelatedDocs] fetch failed:', err)
        if (!cancelled) setDocs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedFile, vaultPath])

  return { docs, loading }
}

function RelatedDocCard({ doc, onClick }: { doc: RelatedDoc; onClick: () => void }) {
  return (
    <button
      className="related-doc-card"
      data-testid={TEST_IDS.RELATED_DOC_CARD}
      onClick={onClick}
      type="button"
    >
      <span className="related-doc-title">{doc.title}</span>
      <span className="related-doc-summary">{truncateSummary(doc.summary)}</span>
      <span className="related-doc-score">{formatScore(doc.score)}</span>
    </button>
  )
}

function useResizeHandle() {
  const { rightPanelWidth, setRightPanelWidth } = useLayoutStore()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = rightPanelWidth
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [rightPanelWidth]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      setRightPanelWidth(startWidth.current + delta)
    },
    [setRightPanelWidth]
  )

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp }
}

export function RelatedDocsPanel() {
  const selectedFile = useEditorStore((s) => s.selectedFile)
  const selectFile = useEditorStore((s) => s.selectFile)
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const toggleRightDrawer = useLayoutStore((s) => s.toggleRightDrawer)
  const { docs, loading } = useRelatedDocs(selectedFile, vaultPath)
  const { onPointerDown, onPointerMove, onPointerUp } = useResizeHandle()

  return (
    <div className="related-docs-panel" data-testid={TEST_IDS.RELATED_DOCS_PANEL} style={{ position: 'relative' }}>
      <div
        className="resize-handle resize-handle-left"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="sidebar-header">
        Related
        <button className="toolbar-btn" onClick={toggleRightDrawer} type="button" title="Collapse panel">
          &#x25B8;
        </button>
      </div>
      <div className="related-docs-list">
        {loading && <div className="properties-empty">Loading...</div>}
        {!loading && docs.length === 0 && (
          <div className="properties-empty">
            {selectedFile ? 'No related docs found' : 'Select a file to see related docs'}
          </div>
        )}
        {!loading &&
          docs.map((doc) => (
            <RelatedDocCard
              key={doc.cardId}
              doc={doc}
              onClick={() => selectFile(vaultPath + '/' + doc.filePath)}
            />
          ))}
      </div>
    </div>
  )
}
