import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DataRowResult, DataSearchResult, DataSessionInfo } from '@core/data/types'
import { IpcRowSource } from '@/lib/data-source'
import { DataSearchBar } from './DataSearchBar'

const ROW_HEIGHT_PX = 28
const OVERSCAN_ROWS = 10
const INDEX_COLUMN_WIDTH_PX = 64
const DATA_COLUMN_WIDTH_PX = 180

interface DataGridViewProps {
  filePath: string
  info: DataSessionInfo
}

/** Virtualized read-only grid over a windowed IPC row source. */
export function DataGridView({ filePath, info }: DataGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const source = useMemo(() => new IpcRowSource(filePath), [filePath])
  const [, setLoadedTick] = useState(0)
  const [selectedRow, setSelectedRow] = useState<DataRowResult | null>(null)
  const [matchIndexes, setMatchIndexes] = useState<number[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)

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

  const columns = info.schema.columns
  const gridTemplate = `${INDEX_COLUMN_WIDTH_PX}px repeat(${columns.length}, minmax(${DATA_COLUMN_WIDTH_PX}px, 1fr))`
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
        <div className="data-grid-header" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="data-grid-cell data-grid-index">#</div>
          {columns.map((col) => (
            <div key={col.name} className="data-grid-cell data-grid-colname" title={`${col.type}`}>
              {col.name}
            </div>
          ))}
        </div>
        <div className="data-grid-body" style={{ height: virtualizer.getTotalSize() }}>
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
      {selectedRow && (
        <div className="data-grid-detail">
          <div className="data-grid-detail-bar">
            <span>row {selectedRow.index}</span>
            <button className="toolbar-btn" onClick={() => setSelectedRow(null)}>
              Close
            </button>
          </div>
          <pre>{JSON.stringify(selectedRow.error ?? selectedRow.record, null, 2)}</pre>
        </div>
      )}
    </div>
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
