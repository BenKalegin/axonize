import React, { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { TEST_IDS } from '@/lib/testids'
import { renderMarkdown } from '@/lib/markdown-renderer'
import {
  extractMermaidCodeFence,
  getMermaidRendererFromMarkdown,
  isMermaidRenderSource,
  prepareMermaidSourceForRender,
  setMermaidRendererInMarkdown,
  stripMermaidFrontmatter
} from '@/lib/mermaid-render-source'
import { canRenderWithDoodles, renderMermaidWithDoodles } from '@/lib/doodles-render'
import { looksLikeBpmnXml, renderBpmnXmlAsSvg } from '@/lib/bpmn-render'
import { looksLikeVegaLite, renderVegaLiteAsSvg } from '@/lib/vega-render'
import {
  MermaidRenderer,
  getMermaidRenderer
} from '@core/markdown/mermaid-renderer-flag'
import type { MarkdownSection } from '@/lib/section-splitter'
import { DiagramVisualEditorModal } from './DiagramVisualEditorModal'
import { TableVisualEditorModal } from './TableVisualEditorModal'
import { HtmlIsland } from './HtmlIsland'
import { InteractiveIsland } from './InteractiveIsland'

let mermaidCounter = 0
let mermaidRenderQueue: Promise<unknown> = Promise.resolve()

const TEXTAREA_MIN_HEIGHT = 120
const COPY_RESET_DELAY_MS = 2000
const HTML_PREVIEW_DEBOUNCE_MS = 300

interface SectionBlockProps {
  section: MarkdownSection
  onSave: (sectionId: string, newMarkdown: string) => void
  onLinkClick: (e: React.MouseEvent) => void
  fileDir?: string
  vaultPath?: string | null
  filePath?: string | null
}

export const SectionBlock = React.memo(function SectionBlock({
  section,
  onSave,
  onLinkClick,
  fileDir,
  vaultPath,
  filePath
}: SectionBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [renderKey, setRenderKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [llmOpen, setLlmOpen] = useState(false)
  const [llmInstruction, setLlmInstruction] = useState('')
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState('')
  const [visualOpen, setVisualOpen] = useState(false)
  const [tableVisualOpen, setTableVisualOpen] = useState(false)
  const [mermaidSvg, setMermaidSvg] = useState('')
  const [mermaidError, setMermaidError] = useState('')
  const [bpmnSvg, setBpmnSvg] = useState('')
  const [bpmnError, setBpmnError] = useState('')
  const [vegaSvg, setVegaSvg] = useState('')
  const [vegaError, setVegaError] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const viewRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMermaidSection = section.kind === 'mermaid'
  const isTableSection = section.kind === 'table'
  const isBpmnSection = section.kind === 'bpmn'
  const isVegaSection = section.kind === 'vega'
  const isHtmlSection = section.kind === 'html'
  const isInteractiveSection = section.kind === 'interact'
  // Both HTML-flavored islands carry their content in a single fenced block.
  const islandFenceLang = isHtmlSection ? 'html' : isInteractiveSection ? 'interact' : null

  useEffect(() => {
    if (isMermaidSection || isBpmnSection || isVegaSection || islandFenceLang !== null) {
      setHtml('')
      return
    }

    let cancelled = false
    renderMarkdown(section.rawMarkdown, fileDir).then((result) => {
      if (!cancelled) {
        setHtml(result)
        setSaving(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isMermaidSection, isBpmnSection, isVegaSection, islandFenceLang, section.rawMarkdown, fileDir])

  useEffect(() => {
    if (!isBpmnSection || editing) return
    const xml = extractFenceContent(section.rawMarkdown, 'bpmn') ?? section.rawMarkdown
    if (!looksLikeBpmnXml(xml)) {
      setBpmnSvg('')
      setBpmnError('Block does not look like BPMN 2.0 XML (expected <bpmn:definitions>).')
      setSaving(false)
      return
    }
    try {
      const svg = renderBpmnXmlAsSvg(xml)
      setBpmnSvg(svg)
      setBpmnError('')
      setSaving(false)
    } catch (err) {
      console.error('[bpmn] render failed:', err)
      setBpmnSvg('')
      setBpmnError(err instanceof Error ? err.message : 'BPMN render failed')
      setSaving(false)
    }
  }, [editing, isBpmnSection, renderKey, section.rawMarkdown])

  useEffect(() => {
    if (!isVegaSection || editing) return
    const spec = extractFenceContent(section.rawMarkdown, 'vega-lite') ?? section.rawMarkdown
    if (!looksLikeVegaLite(spec)) {
      setVegaSvg('')
      setVegaError('Block does not look like a Vega-Lite spec (expected JSON with mark + encoding).')
      setSaving(false)
      return
    }
    try {
      const svg = renderVegaLiteAsSvg(spec)
      setVegaSvg(svg)
      setVegaError('')
      setSaving(false)
    } catch (err) {
      console.error('[vega-lite] render failed:', err)
      setVegaSvg('')
      setVegaError(err instanceof Error ? err.message : 'Vega-Lite render failed')
      setSaving(false)
    }
  }, [editing, isVegaSection, renderKey, section.rawMarkdown])

  useEffect(() => {
    if (!isMermaidSection || editing) return

    let cancelled = false
    const rawSource = extractMermaidCodeFence(section.rawMarkdown) ?? section.rawMarkdown
    renderMermaidSource(rawSource)
      .then((svg) => {
        if (cancelled) return
        setMermaidSvg(svg)
        setMermaidError('')
        setSaving(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[mermaid] render failed:', err)
        setMermaidSvg('')
        setMermaidError(err instanceof Error ? err.message : 'Mermaid render failed')
        setSaving(false)
      })

    return () => {
      cancelled = true
    }
  }, [editing, isMermaidSection, renderKey, section.rawMarkdown])

  // Live (debounced) preview source for the focus-mode HTML/interactive split editor.
  useEffect(() => {
    if (islandFenceLang === null) return
    if (!editing) {
      setPreviewHtml(extractFenceContent(section.rawMarkdown, islandFenceLang) ?? section.rawMarkdown)
      return
    }
    const timer = setTimeout(() => {
      setPreviewHtml(extractFenceContent(draft, islandFenceLang) ?? draft)
    }, HTML_PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [islandFenceLang, editing, draft, section.rawMarkdown])

  useEffect(() => {
    if (editing || !html || !viewRef.current) return
    // Schedule after React finishes flushing dangerouslySetInnerHTML into the DOM
    const frame = requestAnimationFrame(() => {
      if (viewRef.current) replaceMermaidBlocks(viewRef.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [html, editing, renderKey])

  const handleEdit = useCallback(() => {
    setDraft(section.rawMarkdown)
    setEditing(true)
    setLlmOpen(false)
    setLlmError('')
    setLlmInstruction('')
    setVisualOpen(false)
    setTableVisualOpen(false)
  }, [section.rawMarkdown])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setLlmOpen(false)
    setLlmError('')
    setVisualOpen(false)
    setTableVisualOpen(false)
  }, [])

  const handleSave = useCallback(() => {
    setSaving(true)
    setRenderKey((k) => k + 1)
    onSave(section.id, draft)
    setEditing(false)
    setLlmOpen(false)
    setVisualOpen(false)
    setTableVisualOpen(false)
  }, [onSave, section.id, draft])

  const moveCursorToLineBoundary = useCallback(
    (isHome: boolean, fullDocBoundary: boolean, extendSelection: boolean) => {
      const ta = textareaRef.current
      if (!ta) return
      const { selectionStart, selectionEnd, value } = ta
      let target: number
      if (isHome) {
        target = fullDocBoundary ? 0 : value.lastIndexOf('\n', selectionStart - 1) + 1
      } else if (fullDocBoundary) {
        target = value.length
      } else {
        const nextNewline = value.indexOf('\n', selectionEnd)
        target = nextNewline === -1 ? value.length : nextNewline
      }
      if (extendSelection) {
        if (isHome) ta.setSelectionRange(target, selectionEnd)
        else ta.setSelectionRange(selectionStart, target)
      } else {
        ta.setSelectionRange(target, target)
      }
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
        return
      }
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
        return
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        e.stopPropagation()
        moveCursorToLineBoundary(e.key === 'Home', e.metaKey || e.ctrlKey, e.shiftKey)
        return
      }
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.stopPropagation()
      }
    },
    [handleCancel, handleSave, moveCursorToLineBoundary]
  )

  const handleLlmSubmit = useCallback(async () => {
    if (!llmInstruction.trim() || llmLoading) return
    setLlmLoading(true)
    setLlmError('')
    try {
      const result = await window.axonize.llm.rewriteSection(draft, llmInstruction.trim(), {
        vaultPath,
        filePath
      })
      setDraft(result)
      setLlmInstruction('')
      setLlmOpen(false)
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : 'Rewrite failed')
    } finally {
      setLlmLoading(false)
    }
  }, [draft, filePath, llmInstruction, llmLoading, vaultPath])

  const handleLlmKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleLlmSubmit()
      }
      if (e.key === 'Escape') setLlmOpen(false)
    },
    [handleLlmSubmit]
  )

  const handleRendererChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as MermaidRenderer
      setDraft((current) => setMermaidRendererInMarkdown(current, value))
    },
    []
  )

  const handleCopy = useCallback(async () => {
    const source = extractMermaidCodeFence(draft) ?? draft
    try {
      const svg = await renderMermaidSource(source)
      const utf8Safe = unescape(encodeURIComponent(svg))
      const dataUri = `data:image/svg+xml;base64,${btoa(utf8Safe)}`
      const html = `<img src="${dataUri}" alt="mermaid diagram" />`
      await window.axonize.clipboard.writeTextAndHtml(draft, html)
    } catch (err) {
      console.error('[copy] mermaid render failed, copying source only:', err)
      await navigator.clipboard.writeText(draft)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS)
  }, [draft])

  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(ta.scrollHeight, TEXTAREA_MIN_HEIGHT) + 'px'
  }, [])

  useEffect(() => {
    if (editing) autoResizeTextarea()
  }, [editing, draft, autoResizeTextarea])

  if (editing) {
    return (
      <div
        id={section.id}
        className="section-block section-block--editing"
        data-testid={TEST_IDS.SECTION_BLOCK}
        onKeyDown={handleKeyDown}
      >
        <div className="section-editor" data-testid={TEST_IDS.SECTION_EDITOR}>
          <div className="section-editor-toolbar">
            <button
              className="toolbar-btn active"
              data-testid={TEST_IDS.SECTION_SAVE_BTN}
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="toolbar-btn"
              data-testid={TEST_IDS.SECTION_CANCEL_BTN}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="toolbar-btn"
              data-testid={TEST_IDS.SECTION_AI_BTN}
              onClick={() => setLlmOpen(!llmOpen)}
            >
              AI Rewrite
            </button>
            {isMermaidSection && (
              <button
                className="toolbar-btn"
                data-testid={TEST_IDS.SECTION_VISUAL_EDIT_BTN}
                onClick={() => setVisualOpen(true)}
              >
                Visual edit
              </button>
            )}
            {isTableSection && (
              <button
                className="toolbar-btn"
                data-testid={TEST_IDS.SECTION_TABLE_VISUAL_EDIT_BTN}
                onClick={() => setTableVisualOpen(true)}
              >
                Visual edit
              </button>
            )}
            {isMermaidSection && (
              <button className="toolbar-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
            {isMermaidSection && (
              <label className="section-editor-renderer">
                Renderer:
                <select
                  className="section-editor-renderer-select"
                  data-testid={TEST_IDS.SECTION_RENDERER_SELECT}
                  value={getMermaidRendererFromMarkdown(draft)}
                  onChange={handleRendererChange}
                >
                  <option value={MermaidRenderer.Doodles}>doodles</option>
                  <option value={MermaidRenderer.Legacy}>legacy</option>
                </select>
              </label>
            )}
          </div>
          <div className={islandFenceLang !== null ? 'section-editor-split' : undefined}>
            <textarea
              ref={textareaRef}
              className="section-editor-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            {islandFenceLang !== null && (
              <div className="section-editor-preview">
                {isInteractiveSection ? (
                  <InteractiveIsland html={previewHtml} autoRun />
                ) : (
                  <HtmlIsland html={previewHtml} />
                )}
              </div>
            )}
          </div>
          {llmOpen && (
            <div className="section-llm-input">
              <input
                type="text"
                data-testid={TEST_IDS.SECTION_LLM_INPUT}
                placeholder="How should I rewrite this section?"
                value={llmInstruction}
                onChange={(e) => setLlmInstruction(e.target.value)}
                onKeyDown={handleLlmKeyDown}
                disabled={llmLoading}
                autoFocus
              />
              {llmLoading && <span className="section-llm-loading" />}
            </div>
          )}
          {llmError && <div className="section-llm-error">{llmError}</div>}
          {visualOpen && (
            <DiagramVisualEditorModal
              markdown={draft}
              renderedSvg={mermaidSvg}
              onApply={(nextMarkdown) => {
                setDraft(nextMarkdown)
                setVisualOpen(false)
              }}
              onClose={() => setVisualOpen(false)}
            />
          )}
          {tableVisualOpen && (
            <TableVisualEditorModal
              markdown={draft}
              onApply={(nextMarkdown) => {
                setDraft(nextMarkdown)
                setTableVisualOpen(false)
              }}
              onClose={() => setTableVisualOpen(false)}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      id={section.id}
      className={`section-block${saving ? ' section-block--saving' : ''}`}
      data-testid={TEST_IDS.SECTION_BLOCK}
    >
      {saving && <div className="section-saving-bar" />}
      <button
        className="section-edit-btn"
        data-testid={TEST_IDS.SECTION_EDIT_BTN}
        onClick={handleEdit}
      >
        edit
      </button>
      {isMermaidSection ? (
        <div className="section-view" onClick={onLinkClick}>
          {mermaidSvg && (
            <div
              className="mermaid-diagram"
              dangerouslySetInnerHTML={{ __html: mermaidSvg }}
            />
          )}
          {mermaidError && (
            <pre className="mermaid-render-error"><code>{section.rawMarkdown}</code></pre>
          )}
        </div>
      ) : isBpmnSection ? (
        <div className="section-view" onClick={onLinkClick}>
          {bpmnSvg && (
            <div
              className="bpmn-diagram"
              dangerouslySetInnerHTML={{ __html: bpmnSvg }}
            />
          )}
          {bpmnError && (
            <pre className="bpmn-render-error"><code>{section.rawMarkdown}</code></pre>
          )}
        </div>
      ) : isVegaSection ? (
        <div className="section-view" onClick={onLinkClick}>
          {vegaSvg && (
            <div
              className="vega-chart"
              dangerouslySetInnerHTML={{ __html: vegaSvg }}
            />
          )}
          {vegaError && (
            <pre className="vega-render-error"><code>{section.rawMarkdown}</code></pre>
          )}
        </div>
      ) : isHtmlSection ? (
        <div className="section-view">
          <HtmlIsland html={previewHtml} />
        </div>
      ) : isInteractiveSection ? (
        <div className="section-view">
          <InteractiveIsland html={previewHtml} />
        </div>
      ) : (
        <div
          ref={viewRef}
          className="section-view"
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={onLinkClick}
        />
      )}
    </div>
  )
})

/** Strip a fenced ```<lang>``` block from a section's raw markdown, leaving the inner content. */
function extractFenceContent(rawMarkdown: string, lang: string): string | undefined {
  const match = new RegExp('```(?:' + lang + ')\\s*\\n([\\s\\S]*?)```').exec(rawMarkdown)
  return match ? match[1]!.trimEnd() : undefined
}

const SHAPE_WRAPPERS: [string, string][] = [
  ['((', '))'], ['(', ')'],
  ['[[', ']]'], ['[', ']'],
  ['{{', '}}'], ['{', '}'],
  ['/', '/'], ['/', '\\'], ['\\', '/'], ['\\', '\\'],
  ['>', ']']
]

/**
 * Replace literal `\n` inside bracket-delimited node labels with `<br/>`
 * and wrap the text in quotes so mermaid treats parentheses as text.
 */
function normalizeMermaidSource(src: string): string {
  return src.replace(/\[([^\]]*\\n[^\]]*)\]/g, (_match, content: string) => {
    let prefix = ''
    let suffix = ''
    let text = content

    for (const [p, s] of SHAPE_WRAPPERS) {
      if (text.startsWith(p) && text.endsWith(s)) {
        prefix = p
        suffix = s
        text = text.slice(p.length, -s.length)
        break
      }
    }

    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1)
    }
    text = text.replace(/\\n/g, '<br/>')

    return `[${prefix}"${text}"${suffix}]`
  })
}

async function replaceMermaidBlocks(container: HTMLElement): Promise<void> {
  const codeBlocks = Array.from(container.querySelectorAll('pre code'))
  for (const codeEl of codeBlocks) {
    const pre = codeEl.parentElement
    if (!pre) continue

    const raw = codeEl.textContent ?? ''
    if (!raw.trim()) continue
    if (!isMermaidRenderSource(raw, codeEl.getAttribute('class') ?? '')) continue

    const renderer = getMermaidRenderer(raw)
    const prepared = prepareMermaidSourceForRender(raw)
    const source = normalizeMermaidSource(prepared)
    const fallbackSource = normalizeMermaidSource(stripMermaidFrontmatter(prepared))

    try {
      const svg = await renderMermaidPreparedSource(source, fallbackSource, renderer)
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-diagram'
      wrapper.innerHTML = svg
      lockSvgToIntrinsicSize(wrapper)

      pre.replaceWith(wrapper)
    } catch (err) {
      console.error('[mermaid] render failed:', err)
    }
  }
}

async function renderMermaidSource(rawSource: string): Promise<string> {
  const renderer = getMermaidRenderer(rawSource)
  const prepared = prepareMermaidSourceForRender(rawSource)
  const source = normalizeMermaidSource(prepared)
  const fallbackSource = normalizeMermaidSource(stripMermaidFrontmatter(prepared))
  const svg = await renderMermaidPreparedSource(source, fallbackSource, renderer)
  const wrapper = document.createElement('div')
  wrapper.innerHTML = svg
  lockSvgToIntrinsicSize(wrapper)
  applyMermaidClickLinks(wrapper, rawSource)
  return wrapper.innerHTML
}

const CLICK_DIRECTIVE_RE = /click\s+(\w+)\s+["']([^"']+)["']/g
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

// Wires `click NODE "url"` directives to the rendered SVG so node clicks navigate.
// Two renderers need different handling: the mermaid ELK path emits <a> elements
// without href (fill them in); the doodles path emits <g data-node-id> groups with
// no anchor at all (wrap them in one).
function applyMermaidClickLinks(wrapper: HTMLElement, source: string): void {
  const links = parseClickDirectives(source)
  if (links.size === 0) return
  wireHreflessAnchors(wrapper, links)
  wireDoodlesNodeGroups(wrapper, links)
}

function parseClickDirectives(source: string): Map<string, string> {
  const links = new Map<string, string>()
  let match
  while ((match = CLICK_DIRECTIVE_RE.exec(source)) !== null) {
    const [, nodeId, url] = match
    links.set(nodeId, url)
  }
  return links
}

// Mermaid's ELK renderer emits <a> elements without href; the SVG group id embeds
// the node id (e.g. `flowchart-A-3`), so match by substring.
function wireHreflessAnchors(wrapper: HTMLElement, links: Map<string, string>): void {
  for (const anchor of wrapper.querySelectorAll('a')) {
    if (anchor.hasAttribute('href') || anchor.hasAttribute('xlink:href')) continue

    const nodeId = anchor.closest('[id]')?.getAttribute('id')
    if (!nodeId) continue

    for (const [linkNodeId, url] of links) {
      if (nodeId.includes(linkNodeId)) {
        anchor.setAttribute('xlink:href', url)
        break
      }
    }
  }
}

// Doodles emits `<g data-node-id="A">` with the exact source node id and no anchor;
// wrap matching groups in an <a> so the shared link-click handler navigates them.
function wireDoodlesNodeGroups(wrapper: HTMLElement, links: Map<string, string>): void {
  for (const group of wrapper.querySelectorAll('[data-node-id]')) {
    const url = links.get(group.getAttribute('data-node-id') ?? '')
    if (!url || group.closest('a')) continue

    const anchor = document.createElementNS(SVG_NAMESPACE, 'a')
    anchor.setAttribute('xlink:href', url)
    anchor.style.cursor = 'pointer'
    group.parentNode?.insertBefore(anchor, group)
    anchor.appendChild(group)
  }
}

function renderMermaidPreparedSource(
  source: string,
  fallbackSource: string,
  renderer: MermaidRenderer
): Promise<string> {
  // Per-diagram `renderer: legacy` opts out of doodles entirely — used when
  // the new doodles/filigree path produces an ugly layout for a specific
  // diagram. Default (`doodles`) tries doodles first for kinds it knows how
  // to render (flowchart/graph/classDiagram/C4), and falls back to the
  // mermaid library on error or for unsupported kinds.
  if (renderer === MermaidRenderer.Doodles && canRenderWithDoodles(source)) {
    return renderMermaidWithDoodles(source).catch(() =>
      renderMermaidViaLibrary(source, fallbackSource)
    )
  }
  return renderMermaidViaLibrary(source, fallbackSource)
}

function renderMermaidViaLibrary(source: string, fallbackSource: string): Promise<string> {
  const id = `mermaid-${Date.now()}-${++mermaidCounter}`
  const render = async () => {
    document.getElementById(`d${id}`)?.remove()
    document.getElementById(`d${id}-fallback`)?.remove()

    try {
      return (await mermaid.render(id, source)).svg
    } catch (err) {
      document.getElementById(`d${id}`)?.remove()
      return (await mermaid.render(`${id}-fallback`, fallbackSource)).svg
    } finally {
      document.getElementById(`d${id}`)?.remove()
      document.getElementById(`d${id}-fallback`)?.remove()
    }
  }

  const queued = mermaidRenderQueue.then(render, render)
  mermaidRenderQueue = queued.catch(() => {})
  return queued
}

function lockSvgToIntrinsicSize(wrapper: HTMLElement): void {
  const svgEl = wrapper.querySelector('svg')
  if (!svgEl) return

  const vb = svgEl.getAttribute('viewBox')
  if (!vb) return

  const parts = vb.split(' ')
  const intrinsicWidth = parseFloat(parts[2])
  const intrinsicHeight = parseFloat(parts[3])
  if (!Number.isFinite(intrinsicWidth) || !Number.isFinite(intrinsicHeight)) return

  svgEl.removeAttribute('width')
  svgEl.removeAttribute('height')
  svgEl.removeAttribute('style')
  svgEl.setAttribute('width', String(intrinsicWidth))
  svgEl.setAttribute('height', String(intrinsicHeight))
}
