import { useEffect, useState } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { renderMarkdown } from '../../lib/markdown-renderer'

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

export function MarkdownView() {
  const { selectedFile } = useEditorStore()
  const [html, setHtml] = useState('')

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

  return (
    <div
      className="markdown-view"
      data-testid={TEST_IDS.MARKDOWN_VIEW}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
