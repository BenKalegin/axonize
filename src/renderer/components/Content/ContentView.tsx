import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { useVaultStore } from '../../store/vault-store'
import { useRagStore } from '../../store/rag-store'
import { useGeneratedDocsStore } from '../../store/generated-docs-store'
import { MarkdownView } from './MarkdownView'
import { RAGAnswerView } from './RAGAnswerView'
import { GeneratedDocHeader } from './GeneratedDocHeader'
import { MakePermanentDialog } from '../Sidebar/MakePermanentDialog'
import { GraphView } from '../Graph/GraphView'
import { WelcomeScreen } from './WelcomeScreen'
import { ZoomControls } from './ZoomControls'

const ZOOM_STEPS = [50, 67, 80, 90, 100, 110, 125, 150, 175, 200]

export function ContentView() {
  const { viewMode, selectedFile } = useEditorStore()
  const { vaultPath } = useVaultStore()
  const { lastResponse, isQuerying } = useRagStore()
  const { docs } = useGeneratedDocsStore()
  const [zoomPercent, setZoomPercent] = useState(100)
  const [permanentDoc, setPermanentDoc] = useState<typeof docs[0] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)

  const zoomIn = useCallback(() => {
    setZoomPercent((prev) => {
      const idx = ZOOM_STEPS.indexOf(prev)
      if (idx >= 0 && idx < ZOOM_STEPS.length - 1) return ZOOM_STEPS[idx + 1]
      const next = ZOOM_STEPS.find((s) => s > prev)
      return next ?? prev
    })
  }, [])

  const zoomOut = useCallback(() => {
    setZoomPercent((prev) => {
      const idx = ZOOM_STEPS.indexOf(prev)
      if (idx > 0) return ZOOM_STEPS[idx - 1]
      const prev_steps = ZOOM_STEPS.filter((s) => s < prev)
      return prev_steps.length > 0 ? prev_steps[prev_steps.length - 1] : prev
    })
  }, [])

  const resetZoom = useCallback(() => setZoomPercent(100), [])

  // Apply zoom via ref to avoid re-rendering children (preserves mermaid SVGs)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.style.zoom = String(zoomPercent / 100)
    }
  }, [zoomPercent])

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else if (e.deltaY > 0) zoomOut()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoomIn, zoomOut])

  const generatedDoc = useMemo(
    () => selectedFile ? docs.find((d) => d.filePath === selectedFile) ?? null : null,
    [selectedFile, docs]
  )

  const showZoom = vaultPath && (
    lastResponse ||
    (viewMode === 'markdown' && selectedFile)
  )

  const isGraph = vaultPath && viewMode === 'graph'

  return (
    <div className="content-view" data-testid={TEST_IDS.CONTENT_VIEW} ref={outerRef}>
      {isGraph ? (
        <GraphView />
      ) : (
        <div className="content-scroll" ref={scrollRef}>
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
          ) : selectedFile ? (
            <>
              {generatedDoc && (
                <GeneratedDocHeader doc={generatedDoc} onMakePermanent={() => setPermanentDoc(generatedDoc)} />
              )}
              <MarkdownView />
            </>
          ) : (
            <div className="empty-state" data-testid={TEST_IDS.EMPTY_STATE}>
              <p>Select a file to view</p>
            </div>
          )}
        </div>
      )}
      {showZoom && (
        <ZoomControls
          zoom={zoomPercent}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
        />
      )}
      {permanentDoc && (
        <MakePermanentDialog doc={permanentDoc} onClose={() => setPermanentDoc(null)} />
      )}
    </div>
  )
}
