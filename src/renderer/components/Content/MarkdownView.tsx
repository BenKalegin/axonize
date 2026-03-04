import React, { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { renderMarkdown } from '@/lib/markdown-renderer'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  flowchart: { useMaxWidth: false },
  sequence: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
  journey: { useMaxWidth: false },
  class: { useMaxWidth: false },
  state: { useMaxWidth: false },
  er: { useMaxWidth: false },
  pie: { useMaxWidth: false },
  architecture: { useMaxWidth: false }
})

declare global {
  interface Window {
    axonize: import('../../../preload').AxonizeAPI
  }
}

let mermaidCounter = 0

export const MarkdownView = React.memo(function MarkdownView() {
  const { selectedFile, selectFile } = useEditorStore()
  const { vaultPath } = useVaultStore()
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedFile) return
    let cancelled = false

    window.axonize.file.read(selectedFile).then(async (content) => {
      if (cancelled) return
      const stripped = content.replace(/^---\n[\s\S]*?\n---\n/, '')
      const rendered = await renderMarkdown(stripped)
      setHtml(rendered)
    })

    return () => {
      cancelled = true
    }
  }, [selectedFile])

  useEffect(() => {
    if (!html || !containerRef.current) return

    const codeBlocks = containerRef.current.querySelectorAll('pre code.language-mermaid')
    if (codeBlocks.length === 0) return

    let cancelled = false

    ;(async () => {
      for (const codeEl of codeBlocks) {
        if (cancelled) return
        const pre = codeEl.parentElement
        if (!pre) continue

        const source = codeEl.textContent ?? ''
        if (!source.trim()) continue

        try {
          const id = `mermaid-${++mermaidCounter}`
          const { svg } = await mermaid.render(id, source)
          if (cancelled) return

          const wrapper = document.createElement('div')
          wrapper.className = 'mermaid-diagram'
          wrapper.innerHTML = svg
          pre.replaceWith(wrapper)
        } catch {
          // leave original code block on render failure
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [html])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return

    const href = anchor.getAttribute('href')
    if (!href) return

    // Ignore external links and anchors
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) return

    e.preventDefault()

    // Resolve relative link against current file's directory
    const currentDir = selectedFile ? selectedFile.replace(/\/[^/]+$/, '') : vaultPath
    if (!currentDir) return

    // Strip any anchor fragment
    const cleanHref = href.split('#')[0]
    if (!cleanHref) return

    // Add .md extension if not present
    const target = cleanHref.endsWith('.md') ? cleanHref : `${cleanHref}.md`

    // Resolve the path
    const fullPath = target.startsWith('/')
      ? target
      : `${currentDir}/${target}`

    selectFile(fullPath)
  }, [selectedFile, vaultPath, selectFile])

  return (
    <div
      ref={containerRef}
      className="markdown-view"
      data-testid={TEST_IDS.MARKDOWN_VIEW}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  )
})
