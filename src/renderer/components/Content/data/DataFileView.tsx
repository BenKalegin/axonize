import { useEffect, useState } from 'react'
import type { DataSessionInfo } from '@core/data/types'
import { DataShape } from '@core/data/types'
import { useEditorStore, selectedFilePath } from '@/store/editor-store'
import { DataGridView } from './DataGridView'
import { JsonTreeView } from './JsonTreeView'

const KILOBYTE = 1024

/**
 * Read-only viewer for vault data files (.csv/.json/.jsonl). Opens a windowed
 * session in the main process and renders a virtualized grid (table shape) or
 * collapsible tree (tree-shaped JSON). Rows never load fully into the renderer.
 */
export function DataFileView() {
  const selection = useEditorStore((s) => s.selection)
  const filePath = selectedFilePath(selection)
  const [info, setInfo] = useState<DataSessionInfo | null>(null)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    return window.axonize.vault.onFilesChanged(() => setRefreshTick((t) => t + 1))
  }, [])

  useEffect(() => {
    if (!filePath) return
    let cancelled = false
    window.axonize.data
      .open(filePath)
      .then((opened) => {
        if (cancelled) return
        setInfo(opened)
        setError('')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setInfo(null)
        setError(err instanceof Error ? err.message : 'Failed to open data file')
      })
    return () => {
      cancelled = true
    }
  }, [filePath, refreshTick])

  if (!filePath) return null
  if (error) return <pre className="data-file-error">{error}</pre>
  if (!info) return <div className="data-file-status">Opening…</div>

  const viewKey = `${filePath}:${refreshTick}`
  return (
    <div className="data-file-view">
      <div className="data-file-header">
        <span className="data-file-kind">{info.kind}</span>
        <span>{info.rowCount.toLocaleString()} rows</span>
        <span>{formatBytes(info.byteSize)}</span>
      </div>
      {info.shape === DataShape.Tree ? (
        <JsonTreeView key={viewKey} filePath={filePath} />
      ) : (
        <DataGridView key={viewKey} filePath={filePath} info={info} />
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < KILOBYTE) return `${bytes} B`
  if (bytes < KILOBYTE * KILOBYTE) return `${(bytes / KILOBYTE).toFixed(1)} KB`
  return `${(bytes / (KILOBYTE * KILOBYTE)).toFixed(1)} MB`
}
