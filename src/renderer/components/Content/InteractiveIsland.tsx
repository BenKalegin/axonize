import { useEffect, useMemo, useRef, useState } from 'react'

// Interactive HTML island: runs the author's JavaScript inside a sandboxed
// iframe — the Phase 3 counterpart to the static HtmlIsland.
//
// Security model (docs/ideas/html-and-interactive-islands.md, Phase 3):
// - `sandbox="allow-scripts"` WITHOUT `allow-same-origin`: scripts run, but the
//   frame is a unique opaque origin, so it cannot reach the Axonize window, read
//   app storage/cookies, or make same-origin requests. `allow-modals`,
//   `allow-popups`, `allow-forms`, and top-navigation are all withheld too.
// - CSP `default-src 'none'` blocks ALL network (fetch/xhr/ws/external src), so a
//   running island can compute and draw but cannot exfiltrate. Inline script and
//   style are permitted so the island's own code runs; images limited to data/blob.
// - Click-to-run gate (read mode): nothing executes until the user opts in per
//   island, so opening a shared/cloned vault never auto-runs its scripts.
const SANDBOX = 'allow-scripts'
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;"

const MIN_HEIGHT_PX = 24
const MAX_HEIGHT_PX = 4000
const HEIGHT_MESSAGE_TYPE = 'axonize-island-height'

// Injected into every island: report content height to the parent. We cannot
// measure cross-origin (allow-same-origin is intentionally withheld), so the
// frame posts its own height instead.
const HEIGHT_BOOTSTRAP = `<script>
(function () {
  var post = function () {
    parent.postMessage({ type: '${HEIGHT_MESSAGE_TYPE}', height: document.documentElement.scrollHeight }, '*')
  }
  window.addEventListener('load', post)
  if (window.ResizeObserver) new ResizeObserver(post).observe(document.documentElement)
})()
</script>`

interface InteractiveIslandProps {
  html: string
  // Skip the click-to-run gate (focus-mode preview, where editing is explicit intent).
  autoRun?: boolean
}

function clampHeight(value: number): number {
  return Math.min(Math.max(value, MIN_HEIGHT_PX), MAX_HEIGHT_PX)
}

function buildSrcDoc(html: string, color: string, fontFamily: string): string {
  const base = `html,body{margin:0;padding:0;background:transparent;color:${color};font-family:${fontFamily};}`
  return (
    '<!doctype html><html><head>' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<style>${base}</style>` +
    `</head><body>${html}${HEIGHT_BOOTSTRAP}</body></html>`
  )
}

export function InteractiveIsland({ html, autoRun = false }: InteractiveIslandProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [running, setRunning] = useState(autoRun)
  const [height, setHeight] = useState(MIN_HEIGHT_PX)

  const themeRef = useRef<{ color: string; fontFamily: string } | undefined>(undefined)
  if (!themeRef.current) {
    const bodyStyles = getComputedStyle(document.body)
    themeRef.current = { color: bodyStyles.color, fontFamily: bodyStyles.fontFamily }
  }

  const srcDoc = useMemo(
    () => (running ? buildSrcDoc(html, themeRef.current!.color, themeRef.current!.fontFamily) : ''),
    [html, running]
  )

  useEffect(() => {
    if (!running) return
    const onMessage = (e: MessageEvent): void => {
      if (e.source !== iframeRef.current?.contentWindow) return
      const data = e.data as { type?: string; height?: number }
      if (data?.type === HEIGHT_MESSAGE_TYPE && typeof data.height === 'number') {
        setHeight(clampHeight(data.height))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [running])

  if (!running) {
    return (
      <button className="interactive-island-gate" onClick={() => setRunning(true)}>
        <span className="interactive-island-gate-run">▶ Run interactive content</span>
        <span className="interactive-island-gate-note">scripts execute on click, sandboxed with no network access</span>
      </button>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      className="interactive-island"
      title="Interactive island"
      sandbox={SANDBOX}
      srcDoc={srcDoc}
      style={{ height }}
    />
  )
}
