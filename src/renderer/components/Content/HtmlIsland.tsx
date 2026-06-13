import { useEffect, useMemo, useRef, useState } from 'react'

// Read-mode HTML island: render author HTML inside a sandboxed iframe.
//
// Security model (matches docs/ideas/html-and-interactive-islands.md, Phase 1):
// the sandbox attribute omits `allow-scripts`, so no <script>, inline handler,
// or javascript: URL ever executes — this is the boundary. `allow-same-origin`
// is present only so the parent can read the rendered height for auto-sizing;
// it is safe here precisely because scripts are off. A restrictive CSP blocks
// external network access, allowing only inline styles and data/blob images.
const SANDBOX = 'allow-same-origin'
const CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:;"

const MIN_HEIGHT_PX = 24
const MAX_HEIGHT_PX = 4000
// Static content can still reflow once late layout settles (fonts, wrapped
// text); a single delayed re-measure catches that without a script in-frame.
const REMEASURE_DELAY_MS = 120

interface HtmlIslandProps {
  html: string
  className?: string
}

function buildSrcDoc(html: string, color: string, fontFamily: string): string {
  const base = `html,body{margin:0;padding:0;background:transparent;color:${color};font-family:${fontFamily};}`
  return (
    '<!doctype html><html><head>' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<style>${base}</style>` +
    `</head><body>${html}</body></html>`
  )
}

export function HtmlIsland({ html, className }: HtmlIslandProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const remeasureRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [height, setHeight] = useState(MIN_HEIGHT_PX)

  // Theme colors are read once per mount (one forced reflow). The iframe is
  // static, so it picks up theme changes on the next remount rather than live.
  const themeRef = useRef<{ color: string; fontFamily: string } | undefined>(undefined)
  if (!themeRef.current) {
    const bodyStyles = getComputedStyle(document.body)
    themeRef.current = { color: bodyStyles.color, fontFamily: bodyStyles.fontFamily }
  }

  const srcDoc = useMemo(
    () => buildSrcDoc(html, themeRef.current!.color, themeRef.current!.fontFamily),
    [html]
  )

  useEffect(() => () => {
    if (remeasureRef.current) clearTimeout(remeasureRef.current)
  }, [])

  const measure = (): void => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const measured = doc.documentElement.scrollHeight
    setHeight(Math.min(Math.max(measured, MIN_HEIGHT_PX), MAX_HEIGHT_PX))
  }

  const handleLoad = (): void => {
    measure()
    remeasureRef.current = setTimeout(measure, REMEASURE_DELAY_MS)
  }

  return (
    <iframe
      ref={iframeRef}
      className={className ? `html-island ${className}` : 'html-island'}
      title="HTML island"
      sandbox={SANDBOX}
      srcDoc={srcDoc}
      style={{ height }}
      onLoad={handleLoad}
    />
  )
}
