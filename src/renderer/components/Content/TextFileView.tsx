import { useEffect, useMemo, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore, selectedFilePath } from '@/store/editor-store'

const KILOBYTE = 1024

export function TextFileView() {
  const selection = useEditorStore((s) => s.selection)
  const filePath = selectedFilePath(selection)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    return window.axonize.vault.onFilesChanged(() => setRefreshTick((t) => t + 1))
  }, [])

  useEffect(() => {
    if (!filePath) return
    let cancelled = false
    setContent(null)
    setError('')
    window.axonize.file
      .read(filePath)
      .then((text) => {
        if (cancelled) return
        setContent(text)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setContent('')
        setError(err instanceof Error ? err.message : 'Failed to read text file')
      })
    return () => {
      cancelled = true
    }
  }, [filePath, refreshTick])

  const stats = useMemo(() => {
    const text = content ?? ''
    return {
      bytes: new Blob([text]).size,
      lines: countLines(text)
    }
  }, [content])

  if (!filePath) return null
  if (error) return <pre className="text-file-error">{error}</pre>
  if (content === null) return <div className="text-file-status">Opening...</div>

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath

  return (
    <div className="text-file-view" data-testid={TEST_IDS.TEXT_FILE_VIEW}>
      <div className="text-file-header">
        <span className="text-file-kind">TXT</span>
        <span className="text-file-name" title={filePath}>{fileName}</span>
        <span>{formatCount(stats.lines, 'line')}</span>
        <span>{formatBytes(stats.bytes)}</span>
      </div>
      <pre className="text-file-body">{content}</pre>
    </div>
  )
}

function countLines(text: string): number {
  if (text.length === 0) return 0
  return text.split(/\r\n|\r|\n/).length
}

function formatCount(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}

function formatBytes(bytes: number): string {
  if (bytes < KILOBYTE) return `${bytes} B`
  if (bytes < KILOBYTE * KILOBYTE) return `${(bytes / KILOBYTE).toFixed(1)} KB`
  return `${(bytes / (KILOBYTE * KILOBYTE)).toFixed(1)} MB`
}
