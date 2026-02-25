import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { renderMarkdown } from '../../lib/markdown-renderer'

mermaid.initialize({ startOnLoad: false, theme: 'dark' })

declare global {
  interface Window {
    axonize: {
      vault: {
        open: () => Promise<string | null>
        readFiles: (vaultPath: string) => Promise<unknown[]>
        getRecent: () => Promise<{ path: string; name: string; openedAt: number }[]>
        removeRecent: (path: string) => Promise<void>
      }
      file: {
        read: (filePath: string) => Promise<string>
      }
      rag: {
        indexVault: (vaultPath: string) => Promise<{ chunkCount: number }>
        fullReindex: (vaultPath: string) => Promise<{ chunkCount: number }>
        reindexFile: (vaultPath: string, filePath: string) => Promise<{ chunkCount: number }>
        getStatus: () => Promise<{ chunkCount: number }>
        query: (vaultPath: string, question: string) => Promise<{ answer: string; sources: Array<{ filePath: string; startLine: number; headingPath: string[]; score: number; contentPreview: string }> }>
        onIndexProgress: (callback: (payload: unknown) => void) => () => void
      }
      settings: {
        get: () => Promise<unknown>
        save: (settings: unknown) => Promise<{ ok: boolean }>
      }
    }
  }
}

let mermaidCounter = 0

export function MarkdownView() {
  const { selectedFile } = useEditorStore()
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedFile) return
    let cancelled = false

    window.axonize.file.read(selectedFile).then(async (content) => {
      if (cancelled) return
      const rendered = await renderMarkdown(content)
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

  return (
    <div
      ref={containerRef}
      className="markdown-view"
      data-testid={TEST_IDS.MARKDOWN_VIEW}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
