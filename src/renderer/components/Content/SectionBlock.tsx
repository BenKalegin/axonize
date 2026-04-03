import React, { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { TEST_IDS } from '@/lib/testids'
import { renderMarkdown } from '@/lib/markdown-renderer'
import type { MarkdownSection } from '@/lib/section-splitter'

let mermaidCounter = 0

const TEXTAREA_MIN_HEIGHT = 120

interface SectionBlockProps {
  section: MarkdownSection
  onSave: (sectionId: string, newMarkdown: string) => void
  onLinkClick: (e: React.MouseEvent) => void
}

export const SectionBlock = React.memo(function SectionBlock({
  section,
  onSave,
  onLinkClick
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
  const viewRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    renderMarkdown(section.rawMarkdown).then((result) => {
      if (!cancelled) {
        setHtml(result)
        setSaving(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [section.rawMarkdown])

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
  }, [section.rawMarkdown])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setLlmOpen(false)
    setLlmError('')
  }, [])

  const handleSave = useCallback(() => {
    setSaving(true)
    setRenderKey((k) => k + 1)
    onSave(section.id, draft)
    setEditing(false)
    setLlmOpen(false)
  }, [onSave, section.id, draft])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      }
    },
    [handleCancel, handleSave]
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
      <div
        ref={viewRef}
        className="section-view"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={onLinkClick}
      />
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
  const codeBlocks = container.querySelectorAll('pre code.language-mermaid')
  for (const codeEl of codeBlocks) {
    const pre = codeEl.parentElement
    if (!pre) continue

    const raw = codeEl.textContent ?? ''
    if (!raw.trim()) continue
    const source = normalizeMermaidSource(raw)

    const id = `mermaid-${Date.now()}-${++mermaidCounter}`

    try {
      // Remove any stale temp container mermaid may have left behind for this id
      document.getElementById(`d${id}`)?.remove()

      const { svg } = await mermaid.render(id, source)
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-diagram'
      wrapper.innerHTML = svg

      // Lock diagram to its intrinsic viewBox size so text matches the page font size.
      const svgEl = wrapper.querySelector('svg')
      if (svgEl) {
        const vb = svgEl.getAttribute('viewBox')
        if (vb) {
          const parts = vb.split(' ')
          const intrinsicWidth = parseFloat(parts[2])
          const intrinsicHeight = parseFloat(parts[3])
          svgEl.removeAttribute('width')
          svgEl.removeAttribute('height')
          svgEl.removeAttribute('style')
          svgEl.setAttribute('width', String(intrinsicWidth))
          svgEl.setAttribute('height', String(intrinsicHeight))
        }
      }

      pre.replaceWith(wrapper)
    } catch (err) {
      console.error('[mermaid] render failed:', err)
      // Clean up temp container on failure
      document.getElementById(`d${id}`)?.remove()
    }
  }
}
