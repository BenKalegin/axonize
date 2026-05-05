import React, { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { TEST_IDS } from '@/lib/testids'
import { renderMarkdown } from '@/lib/markdown-renderer'
import {
  extractMermaidCodeFence,
  isMermaidRenderSource,
  prepareMermaidSourceForRender,
  stripMermaidFrontmatter
} from '@/lib/mermaid-render-source'
import type { MarkdownSection } from '@/lib/section-splitter'
import { DiagramVisualEditorModal } from './DiagramVisualEditorModal'

let mermaidCounter = 0
let mermaidRenderQueue: Promise<unknown> = Promise.resolve()

const TEXTAREA_MIN_HEIGHT = 120

interface SectionBlockProps {
  section: MarkdownSection
  onSave: (sectionId: string, newMarkdown: string) => void
  onLinkClick: (e: React.MouseEvent) => void
  fileDir?: string
}

export const SectionBlock = React.memo(function SectionBlock({
  section,
  onSave,
  onLinkClick,
  fileDir
}: SectionBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [renderKey, setRenderKey] = useState(0)
  const [llmOpen, setLlmOpen] = useState(false)
  const [llmInstruction, setLlmInstruction] = useState('')
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState('')
  const [visualOpen, setVisualOpen] = useState(false)
  const [mermaidSvg, setMermaidSvg] = useState('')
  const [mermaidError, setMermaidError] = useState('')
  const viewRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMermaidSection = section.kind === 'mermaid'

  useEffect(() => {
    if (isMermaidSection) {
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
  }, [isMermaidSection, section.rawMarkdown, fileDir])

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
  }, [section.rawMarkdown])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setLlmOpen(false)
    setLlmError('')
    setVisualOpen(false)
  }, [])

  const handleSave = useCallback(() => {
    setSaving(true)
    setRenderKey((k) => k + 1)
    onSave(section.id, draft)
    setEditing(false)
    setLlmOpen(false)
    setVisualOpen(false)
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
      const result = await window.axonize.llm.rewriteSection(draft, llmInstruction.trim())
      setDraft(result)
      setLlmInstruction('')
      setLlmOpen(false)
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : 'Rewrite failed')
    } finally {
      setLlmLoading(false)
    }
  }, [draft, llmInstruction, llmLoading])

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
          </div>
          <textarea
            ref={textareaRef}
            className="section-editor-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
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
        </div>
      </div>
    )
  }

  return (
    <div
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

    const prepared = prepareMermaidSourceForRender(raw)
    const source = normalizeMermaidSource(prepared)
    const fallbackSource = normalizeMermaidSource(stripMermaidFrontmatter(prepared))

    try {
      const svg = await renderMermaidPreparedSource(source, fallbackSource)
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
  const prepared = prepareMermaidSourceForRender(rawSource)
  const source = normalizeMermaidSource(prepared)
  const fallbackSource = normalizeMermaidSource(stripMermaidFrontmatter(prepared))
  const svg = await renderMermaidPreparedSource(source, fallbackSource)
  const wrapper = document.createElement('div')
  wrapper.innerHTML = svg
  lockSvgToIntrinsicSize(wrapper)
  applyMermaidClickLinks(wrapper, rawSource)
  return wrapper.innerHTML
}

// Mermaid's ELK renderer emits <a> elements without href; this wires up href from `click NODE "url"` directives in the source.
function applyMermaidClickLinks(wrapper: HTMLElement, source: string): void {
  const clickRegex = /click\s+(\w+)\s+["']([^"']+)["']/g
  const links = new Map<string, string>()

  let match
  while ((match = clickRegex.exec(source)) !== null) {
    const [, nodeId, url] = match
    links.set(nodeId, url)
  }

  if (links.size === 0) return

  const anchors = wrapper.querySelectorAll('a')
  for (const anchor of anchors) {
    if (anchor.hasAttribute('href') || anchor.hasAttribute('xlink:href')) continue

    const nodeGroup = anchor.closest('[id]')
    const nodeId = nodeGroup?.getAttribute('id')
    if (!nodeId) continue

    for (const [linkNodeId, url] of links) {
      if (nodeId.includes(linkNodeId)) {
        anchor.setAttribute('xlink:href', url)
        break
      }
    }
  }
}

function renderMermaidPreparedSource(source: string, fallbackSource: string): Promise<string> {
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
