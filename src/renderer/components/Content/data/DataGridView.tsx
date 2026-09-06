import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DataRowResult, DataSearchResult, DataSessionInfo } from '@core/data/types'
import { IpcRowSource } from '@/lib/data-source'
import { highlightJson } from '@/lib/json-highlight'
import { handleCodeFileReferenceClick, isDocLink, resolveDocLink } from '@/lib/doc-link'
import { useEditorStore } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { MarkdownContent } from '../MarkdownContent'
import { DataSearchBar } from './DataSearchBar'

const ROW_HEIGHT_PX = 28
const OVERSCAN_ROWS = 10
const INDEX_COLUMN_WIDTH_PX = 64
const DEFAULT_COLUMN_WIDTH_PX = 180
const MIN_COLUMN_WIDTH_PX = 60

interface DataGridViewProps {
  filePath: string
  info: DataSessionInfo
}

/**
 * Virtualized read-only grid over a windowed IPC row source. Header and rows
 * share one fixed pixel template (resizable per column), so cells always align
 * and long values truncate with an ellipsis like a spreadsheet.
 */
export function DataGridView({ filePath, info }: DataGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const source = useMemo(() => new IpcRowSource(filePath), [filePath])
  const [, setLoadedTick] = useState(0)
  const [selectedRow, setSelectedRow] = useState<DataRowResult | null>(null)
  const [matchIndexes, setMatchIndexes] = useState<number[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)

  const columns = info.schema.columns
  const { colWidths, startResize } = useColumnWidths(columns.length)
  const gridTemplate = `${INDEX_COLUMN_WIDTH_PX}px ${colWidths.map((w) => `${w}px`).join(' ')}`
  const totalWidth = INDEX_COLUMN_WIDTH_PX + colWidths.reduce((sum, w) => sum + w, 0)

  const virtualizer = useVirtualizer({
    count: info.rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: OVERSCAN_ROWS
  })

  const virtualRows = virtualizer.getVirtualItems()
  const firstVisible = virtualRows[0]?.index ?? 0
  const lastVisible = virtualRows[virtualRows.length - 1]?.index ?? 0

  useEffect(() => {
    let cancelled = false
    source.ensureRange(firstVisible, lastVisible).then(() => {
      if (!cancelled) setLoadedTick((t) => t + 1)
    })
    return () => {
      cancelled = true
    }
  }, [source, firstVisible, lastVisible])

  const jumpToMatch = useCallback(
    (matchOrdinal: number, matches: number[]) => {
      if (matches.length === 0) return
      const wrapped = ((matchOrdinal % matches.length) + matches.length) % matches.length
      setCurrentMatch(wrapped)
      virtualizer.scrollToIndex(matches[wrapped], { align: 'center' })
    },
    [virtualizer]
  )

  const handleSearch = useCallback(
    (result: DataSearchResult) => {
      setMatchIndexes(result.rowIndexes)
      jumpToMatch(0, result.rowIndexes)
    },
    [jumpToMatch]
  )

  const highlightedRow = currentMatch >= 0 ? matchIndexes[currentMatch] : -1

  return (
    <div className="data-grid">
      <DataSearchBar
        filePath={filePath}
        matchCount={matchIndexes.length}
        currentMatch={currentMatch}
        onResult={handleSearch}
        onNavigate={(delta) => jumpToMatch(currentMatch + delta, matchIndexes)}
      />
      <div className="data-grid-scroll" ref={scrollRef}>
        <div
          className="data-grid-header"
          style={{ gridTemplateColumns: gridTemplate, width: totalWidth }}
        >
          <div className="data-grid-cell data-grid-index">#</div>
          {columns.map((col, i) => (
            <div key={col.name} className="data-grid-cell data-grid-colname" title={col.type}>
              {col.name}
              <div className="data-grid-resize-handle" onMouseDown={(e) => startResize(i, e)} />
            </div>
          ))}
        </div>
        <div
          className="data-grid-body"
          style={{ height: virtualizer.getTotalSize(), width: totalWidth }}
        >
          {virtualRows.map((vRow) => {
            const row = source.rowAt(vRow.index)
            return (
              <div
                key={vRow.key}
                className={gridRowClass(vRow.index, highlightedRow, selectedRow)}
                style={{ gridTemplateColumns: gridTemplate, transform: `translateY(${vRow.start}px)` }}
                onClick={() => setSelectedRow(row ?? null)}
              >
                <div className="data-grid-cell data-grid-index">{vRow.index}</div>
                {renderRowCells(row, columns.map((c) => c.name))}
              </div>
            )
          })}
        </div>
      </div>
      {selectedRow && <RowDetail row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  )
}

/** Per-column pixel widths plus an Excel-style drag-resize initiator for header edges. */
function useColumnWidths(columnCount: number) {
  const [colWidths, setColWidths] = useState<number[]>(() =>
    Array.from({ length: columnCount }, () => DEFAULT_COLUMN_WIDTH_PX)
  )
  const widthsRef = useRef(colWidths)
  widthsRef.current = colWidths

  const startResize = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = widthsRef.current[colIndex]

    const onMove = (ev: MouseEvent) => {
      const width = Math.max(MIN_COLUMN_WIDTH_PX, startWidth + ev.clientX - startX)
      setColWidths((prev) => prev.map((w, i) => (i === colIndex ? width : w)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return { colWidths, startResize }
}

function RowDetail({ row, onClose }: { row: DataRowResult; onClose: () => void }) {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const selectFile = useEditorStore((s) => s.selectFile)

  // Detail markdown lives outside MarkdownView's link interceptor, so corpus
  // doc:// links (and external http links) need their own handling here.
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) {
        handleCodeFileReferenceClick(e, vaultPath, selectFile)
        return
      }
      const href = anchor.getAttribute('href')
      if (!href) return
      if (href.startsWith('http://') || href.startsWith('https://')) return
      e.preventDefault()
      if (isDocLink(href) && vaultPath) {
        void resolveDocLink(href, vaultPath).then((path) => {
          if (path) selectFile(path)
        })
      }
    },
    [vaultPath, selectFile]
  )

  return (
    <div className="data-grid-detail" onClick={handleClick}>
      <div className="data-grid-detail-bar">
        <span>row {row.index}</span>
        <button className="toolbar-btn" onClick={onClose}>
          Close
        </button>
      </div>
      {row.error ? (
        <pre className="data-grid-detail-error">{row.error}</pre>
      ) : (
        <div className="data-grid-detail-fields">
          {Object.entries(row.record).map(([key, value]) => (
            <FieldDetail key={key} name={key} value={value} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Structural markdown signals; a string field rendering as markdown needs at least two. */
const MARKDOWN_SIGNALS = [
  /^#{1,6}\s/m, // heading
  /\*\*[^*\n]+\*\*/, // bold
  /\[[^\]\n]+\]\([^)\n]+\)/, // link
  /^[-*]\s+\S/m, // bullet list
  /^\d+\.\s+\S/m, // ordered list
  /```/ // code fence
]
const MIN_MARKDOWN_SIGNALS = 2

function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_SIGNALS.filter((signal) => signal.test(text)).length >= MIN_MARKDOWN_SIGNALS
}

/**
 * One record field: markdown-looking strings render through the markdown
 * pipeline, other strings as real multi-line text (escapes resolved, readable
 * font), and structured/scalar values as highlighted JSON.
 */
function FieldDetail({ name, value }: { name: string; value: unknown }) {
  const isText = typeof value === 'string'
  const isMarkdown = isText && looksLikeMarkdown(value)
  const html = useMemo(
    () => (isText ? '' : highlightJson(JSON.stringify(value, null, 2) ?? 'undefined')),
    [isText, value]
  )
  return (
    <>
      <div className="data-grid-detail-key">{name}</div>
      {isMarkdown ? (
        <MarkdownContent markdown={value} className="data-grid-detail-md" />
      ) : isText ? (
        <div className="data-grid-detail-text">{value}</div>
      ) : (
        <pre className="data-grid-detail-json">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      )}
    </>
  )
}

function gridRowClass(index: number, highlighted: number, selected: DataRowResult | null): string {
  const classes = ['data-grid-row']
  if (index === highlighted) classes.push('data-grid-row-match')
  if (selected?.index === index) classes.push('data-grid-row-selected')
  return classes.join(' ')
}

function renderRowCells(row: DataRowResult | undefined, columnNames: string[]) {
  if (!row) {
    return columnNames.map((name) => (
      <div key={name} className="data-grid-cell data-grid-loading">
        …
      </div>
    ))
  }
  if (row.error) {
    return columnNames.map((name, i) => (
      <div key={name} className="data-grid-cell data-grid-error" title={row.error ?? ''}>
        {i === 0 ? `⚠ ${row.error}` : ''}
      </div>
    ))
  }
  return columnNames.map((name) => (
    <div key={name} className="data-grid-cell" title={formatCell(row.record[name])}>
      {formatCell(row.record[name])}
    </div>
  ))
}

function formatCell(value: unknown): string {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
