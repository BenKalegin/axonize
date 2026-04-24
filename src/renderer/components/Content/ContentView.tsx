import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { TEST_IDS } from '@/lib/testids'
import {
  useEditorStore,
  ViewMode,
  selectedFilePath,
  isAgentTurnSelection
} from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { useRagStore } from '@/store/rag-store'
import { useGeneratedDocsStore } from '@/store/generated-docs-store'
import { MarkdownView } from './MarkdownView'
import { RAGAnswerView } from './RAGAnswerView'
import { GeneratedDocHeader } from './GeneratedDocHeader'
import { SourcesList } from './SourcesList'
import { MakePermanentDialog } from '../Sidebar/MakePermanentDialog'
import { GraphView } from '../Graph/GraphView'
import { WelcomeScreen } from './WelcomeScreen'
import { ZoomControls } from './ZoomControls'
import { AgentTurnHeader } from './AgentTurnHeader'

const ZOOM_STEPS = [50, 67, 80, 90, 100, 110, 125, 150, 175, 200]

export function ContentView() {
  const viewMode = useEditorStore((s) => s.viewMode)
  const selection = useEditorStore((s) => s.selection)
  const presentationIndex = useEditorStore((s) => s.presentationIndex)
  const presentationTotal = useEditorStore((s) => s.presentationTotal)
  const presentationNext = useEditorStore((s) => s.presentationNext)
  const presentationPrev = useEditorStore((s) => s.presentationPrev)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const selectedFile = selectedFilePath(selection)
  const presentationMode = viewMode === ViewMode.Presentation
  const isGraph = viewMode === ViewMode.Graph
  const isAgentTurn = isAgentTurnSelection(selection)
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

  // Apply zoom via ref so mermaid SVGs don't re-render on every zoom step.
  useEffect(() => {
    if (scrollRef.current) {
      if (isGraph) {
        scrollRef.current.style.zoom = '1'
      } else {
        scrollRef.current.style.zoom = String(zoomPercent / 100)
      }
    }
  }, [zoomPercent, isGraph])

  useEffect(() => {
    if (presentationMode) return
    const el = outerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      if (isGraph) return

      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else if (e.deltaY > 0) zoomOut()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoomIn, zoomOut, presentationMode, isGraph])

  useEffect(() => {
    if (!presentationMode) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        presentationNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        presentationPrev()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setViewMode(ViewMode.Markdown)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [presentationMode, presentationNext, presentationPrev, setViewMode])

  useEffect(() => {
    if (!presentationMode) return
    const el = outerRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button, .presentation-bar')) return
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.toString().length > 0) return
      presentationNext()
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY > 0) presentationNext()
      else if (e.deltaY < 0) presentationPrev()
    }

    el.addEventListener('click', handleClick)
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('click', handleClick)
      el.removeEventListener('wheel', handleWheel)
    }
  }, [presentationMode, presentationNext, presentationPrev])

  const generatedDoc = useMemo(
    () => (selectedFile && !isAgentTurn) ? docs.find((d) => d.filePath === selectedFile) ?? null : null,
    [selectedFile, docs, isAgentTurn]
  )

  const showZoom = vaultPath && !isGraph && (
    lastResponse ||
    (viewMode === ViewMode.Markdown && selectedFile)
  )

  const renderBody = () => {
    if (vaultPath && isGraph) return <GraphView />
    return (
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
        ) : isAgentTurn ? (
          <>
            <AgentTurnHeader />
            <MarkdownView />
          </>
        ) : selectedFile ? (
          <>
            {generatedDoc && (
              <GeneratedDocHeader doc={generatedDoc} onMakePermanent={() => setPermanentDoc(generatedDoc)} />
            )}
            <MarkdownView />
            {generatedDoc && generatedDoc.sources.length > 0 && (
              <SourcesList sources={generatedDoc.sources} />
            )}
          </>
        ) : (
          <div className="empty-state" data-testid={TEST_IDS.EMPTY_STATE}>
            <p>Select a file to view</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="content-view" data-testid={TEST_IDS.CONTENT_VIEW} ref={outerRef}>
      {renderBody()}
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
      {presentationMode && presentationTotal > 0 && (
        <div className="presentation-bar">
          <button
            className="toolbar-btn"
            disabled={presentationIndex <= 0}
            onClick={presentationPrev}
          >
            Prev
          </button>
          <span className="presentation-counter">
            {presentationIndex + 1} / {presentationTotal}
          </span>
          <button
            className="toolbar-btn"
            disabled={presentationIndex >= presentationTotal - 1}
            onClick={presentationNext}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
