import { useEffect, useState } from 'react'
import { useEditorStore, selectedFilePath } from '@/store/editor-store'
import { looksLikeBpmnXml, renderBpmnXmlAsSvg } from '@/lib/bpmn-render'

/**
 * Read-only BPMN viewer for `.bpmn` files in the vault. Reads the XML, runs
 * the parse → auto-layout → render pipeline via bpmn-render.ts, and displays
 * the SVG inline. Phase 4b — no editing yet; that ships when we wire the
 * clouddiagram-editor full-page mode.
 */
export function BpmnFileView() {
  const selection = useEditorStore((s) => s.selection)
  const filePath = selectedFilePath(selection)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!filePath) return
    let cancelled = false
    window.axonize.file
      .read(filePath)
      .then((content: string) => {
        if (cancelled) return
        if (!looksLikeBpmnXml(content)) {
          setError(`${filePath} does not look like BPMN 2.0 XML (expected <bpmn:definitions>).`)
          setSvg('')
          return
        }
        try {
          setSvg(renderBpmnXmlAsSvg(content))
          setError('')
        } catch (err) {
          console.error('[bpmn-file-view] render failed:', err)
          setSvg('')
          setError(err instanceof Error ? err.message : 'BPMN render failed')
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('[bpmn-file-view] read failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to read file')
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  if (!filePath) return null

  return (
    <div className="bpmn-file-view">
      {error && <pre className="bpmn-render-error">{error}</pre>}
      {svg && (
        <div
          className="bpmn-diagram"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  )
}
