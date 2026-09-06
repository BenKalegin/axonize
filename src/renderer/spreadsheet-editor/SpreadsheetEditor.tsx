import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseGfmTable, serializeGfmTable } from './gfm-table'
import { HEADER_ROW, type CellAddress, type ColumnAlign, type GfmTableModel } from './types'

export interface SpreadsheetEditorProps {
  /** Initial markdown — must be a single GFM table; parse failure throws. */
  initialMarkdown: string
  /** Called with the serialized GFM markdown when the user clicks Apply. */
  onApply: (markdown: string) => void
  /** Called when the user clicks Cancel or presses Escape. */
  onCancel: () => void
}

const NUMERIC_CELL = /^-?\d+(\.\d+)?$/
const DATE_CELL = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
const ALIGN_CYCLE: ColumnAlign[] = [null, 'left', 'center', 'right']

const TEST_ID_ROOT = 'spreadsheet-editor'
const TEST_ID_APPLY = 'spreadsheet-editor-apply'
const TEST_ID_CANCEL = 'spreadsheet-editor-cancel'

const PostCommitMove = { Right: 'right', Down: 'down', None: 'none' } as const
type PostCommitMove = (typeof PostCommitMove)[keyof typeof PostCommitMove]

const RowAction = { InsertAbove: 'insertAbove', InsertBelow: 'insertBelow', Delete: 'delete' } as const
type RowAction = (typeof RowAction)[keyof typeof RowAction]

const ColumnAction = { InsertLeft: 'insertLeft', InsertRight: 'insertRight', Delete: 'delete' } as const
type ColumnAction = (typeof ColumnAction)[keyof typeof ColumnAction]

function detectColumnAlignment(values: string[]): ColumnAlign {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean)
  if (nonEmpty.length === 0) return null
  if (nonEmpty.every((v) => NUMERIC_CELL.test(v))) return 'right'
  if (nonEmpty.every((v) => DATE_CELL.test(v))) return 'center'
  return null
}

function autoAlignColumns(model: GfmTableModel): GfmTableModel {
  const align = model.align.map((existing, c) => {
    if (existing) return existing
    return detectColumnAlignment(model.rows.map((row) => row[c] ?? ''))
  })
  return { ...model, align }
}

function nextAlign(current: ColumnAlign): ColumnAlign {
  const idx = ALIGN_CYCLE.indexOf(current)
  return ALIGN_CYCLE[(idx + 1) % ALIGN_CYCLE.length]
}

function alignSymbol(align: ColumnAlign): string {
  switch (align) {
    case 'left':
      return 'L'
    case 'center':
      return 'C'
    case 'right':
      return 'R'
    default:
      return '·'
  }
}

function justifyContent(align: ColumnAlign): React.CSSProperties['justifyContent'] {
  if (align === 'center') return 'center'
  if (align === 'right') return 'flex-end'
  return 'flex-start'
}

function insertAt<T>(arr: T[], index: number, value: T): T[] {
  return [...arr.slice(0, index), value, ...arr.slice(index)]
}

function removeAt<T>(arr: T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}

interface KeyHandlerContext {
  ctrlOrMeta: boolean
  shift: boolean
  selected: CellAddress
  jumpToEdge: (dRow: number, dCol: number) => void
  moveSelection: (dRow: number, dCol: number) => void
  startEdit: (initial?: string) => void
  writeCell: (row: number, col: number, value: string) => void
  onCancel: () => void
}

const KEY_HANDLERS: Record<string, (ctx: KeyHandlerContext) => void> = {
  Escape: (ctx) => ctx.onCancel(),
  ArrowUp: (ctx) => (ctx.ctrlOrMeta ? ctx.jumpToEdge(-1, 0) : ctx.moveSelection(-1, 0)),
  ArrowDown: (ctx) => (ctx.ctrlOrMeta ? ctx.jumpToEdge(1, 0) : ctx.moveSelection(1, 0)),
  ArrowLeft: (ctx) => (ctx.ctrlOrMeta ? ctx.jumpToEdge(0, -1) : ctx.moveSelection(0, -1)),
  ArrowRight: (ctx) => (ctx.ctrlOrMeta ? ctx.jumpToEdge(0, 1) : ctx.moveSelection(0, 1)),
  Tab: (ctx) => ctx.moveSelection(0, ctx.shift ? -1 : 1),
  Enter: (ctx) => ctx.startEdit(),
  F2: (ctx) => ctx.startEdit(),
  Delete: (ctx) => ctx.writeCell(ctx.selected.row, ctx.selected.col, ''),
  Backspace: (ctx) => ctx.writeCell(ctx.selected.row, ctx.selected.col, '')
}

export function SpreadsheetEditor({ initialMarkdown, onApply, onCancel }: SpreadsheetEditorProps) {
  const initialModel = useMemo<GfmTableModel>(() => {
    const parsed = parseGfmTable(initialMarkdown)
    if (!parsed) throw new Error('SpreadsheetEditor: initialMarkdown is not a GFM table')
    return parsed
  }, [initialMarkdown])

  const [model, setModel] = useState<GfmTableModel>(initialModel)
  const [selected, setSelected] = useState<CellAddress>({ row: HEADER_ROW, col: 0 })
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingValue !== null) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      gridRef.current?.focus()
    }
  }, [editingValue])

  const styleByCol = useMemo(
    () => model.align.map((a) => ({ justifyContent: justifyContent(a) })),
    [model.align]
  )

  const cellValue = useCallback(
    (row: number, col: number): string => {
      if (row === HEADER_ROW) return model.headers[col] ?? ''
      return model.rows[row]?.[col] ?? ''
    },
    [model]
  )

  const writeCell = useCallback((row: number, col: number, value: string) => {
    setModel((prev) => {
      if (row === HEADER_ROW) {
        const headers = [...prev.headers]
        headers[col] = value
        return { ...prev, headers }
      }
      // Clone only the row being mutated — keeps writes O(cols) per keystroke.
      const rows = prev.rows.slice()
      rows[row] = [...prev.rows[row]]
      rows[row][col] = value
      return { ...prev, rows }
    })
  }, [])

  const moveSelection = useCallback(
    (dRow: number, dCol: number) => {
      setSelected((prev) => {
        const totalCols = model.headers.length
        if (totalCols === 0) return prev
        const maxRow = model.rows.length - 1
        const nextRow = Math.min(Math.max(prev.row + dRow, HEADER_ROW), maxRow)
        const nextCol = Math.min(Math.max(prev.col + dCol, 0), totalCols - 1)
        if (nextRow === prev.row && nextCol === prev.col) return prev
        return { row: nextRow, col: nextCol }
      })
    },
    [model.rows.length, model.headers.length]
  )

  const commitEdit = useCallback(
    (move: PostCommitMove) => {
      if (editingValue === null) return
      writeCell(selected.row, selected.col, editingValue)
      setEditingValue(null)
      if (move === PostCommitMove.Right) moveSelection(0, 1)
      else if (move === PostCommitMove.Down) moveSelection(1, 0)
    },
    [editingValue, selected.row, selected.col, writeCell, moveSelection]
  )

  const jumpToEdge = useCallback(
    (dRow: number, dCol: number) => {
      setSelected((prev) => {
        const totalCols = model.headers.length
        const totalRows = model.rows.length
        if (totalCols === 0) return prev
        let { row, col } = prev
        if (dRow !== 0) {
          while (true) {
            const next = row + dRow
            if (next < HEADER_ROW || next > totalRows - 1) break
            if (cellValue(next, col).trim() === '') break
            row = next
          }
        }
        if (dCol !== 0) {
          while (true) {
            const next = col + dCol
            if (next < 0 || next > totalCols - 1) break
            if (cellValue(row, next).trim() === '') break
            col = next
          }
        }
        if (row === prev.row && col === prev.col) return prev
        return { row, col }
      })
    },
    [model.headers.length, model.rows.length, cellValue]
  )

  const startEdit = useCallback(
    (initial?: string) => {
      const current = cellValue(selected.row, selected.col)
      setEditingValue(initial !== undefined ? initial : current)
    },
    [cellValue, selected.row, selected.col]
  )

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingValue !== null) return
      const handler = KEY_HANDLERS[e.key]
      if (handler) {
        e.preventDefault()
        handler({
          ctrlOrMeta: e.ctrlKey || e.metaKey,
          shift: e.shiftKey,
          selected,
          jumpToEdge,
          moveSelection,
          startEdit,
          writeCell,
          onCancel
        })
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        startEdit(e.key)
      }
    },
    [editingValue, selected, jumpToEdge, moveSelection, startEdit, writeCell, onCancel]
  )

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit(PostCommitMove.Down)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        commitEdit(PostCommitMove.Right)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setEditingValue(null)
      }
    },
    [commitEdit]
  )

  const cycleColumnAlign = useCallback((col: number) => {
    setModel((prev) => {
      const align = [...prev.align]
      align[col] = nextAlign(align[col])
      return { ...prev, align }
    })
  }, [])

  const insertColumn = useCallback((after: number) => {
    setModel((prev) => ({
      headers: insertAt(prev.headers, after + 1, ''),
      rows: prev.rows.map((row) => insertAt(row, after + 1, '')),
      align: insertAt(prev.align, after + 1, null)
    }))
  }, [])

  const deleteColumn = useCallback(
    (index: number) => {
      setModel((prev) => {
        if (prev.headers.length <= 1) return prev
        return {
          headers: removeAt(prev.headers, index),
          rows: prev.rows.map((row) => removeAt(row, index)),
          align: removeAt(prev.align, index)
        }
      })
      setSelected((prev) => {
        // model.headers.length captures the pre-delete length, so newMax = length - 2.
        const newMaxCol = model.headers.length - 2
        if (newMaxCol < 0) return prev
        const nextCol = Math.min(prev.col, newMaxCol)
        if (nextCol === prev.col) return prev
        return { row: prev.row, col: nextCol }
      })
    },
    [model.headers.length]
  )

  const insertRow = useCallback((after: number) => {
    setModel((prev) => {
      const newRow = Array.from({ length: prev.headers.length }, () => '')
      const insertIndex = Math.max(0, after + 1)
      return { ...prev, rows: insertAt(prev.rows, insertIndex, newRow) }
    })
  }, [])

  const deleteRow = useCallback(
    (index: number) => {
      setModel((prev) => {
        if (prev.rows.length === 0 || index < 0) return prev
        return { ...prev, rows: removeAt(prev.rows, index) }
      })
      setSelected((prev) => {
        const newMaxRow = model.rows.length - 2
        if (newMaxRow < HEADER_ROW) return prev
        const nextRow = Math.min(prev.row, newMaxRow)
        if (nextRow === prev.row) return prev
        return { row: nextRow, col: prev.col }
      })
    },
    [model.rows.length]
  )

  const handleApply = useCallback(() => {
    onApply(serializeGfmTable(autoAlignColumns(model)))
  }, [model, onApply])

  const onRowAction = useCallback(
    (action: RowAction) => {
      const row = selected.row
      if (action === RowAction.InsertAbove) insertRow(row === HEADER_ROW ? -1 : row - 1)
      else if (action === RowAction.InsertBelow) insertRow(row)
      else if (row !== HEADER_ROW) deleteRow(row)
    },
    [selected.row, insertRow, deleteRow]
  )

  const onColumnAction = useCallback(
    (action: ColumnAction) => {
      const col = selected.col
      if (action === ColumnAction.InsertLeft) insertColumn(col - 1)
      else if (action === ColumnAction.InsertRight) insertColumn(col)
      else deleteColumn(col)
    },
    [selected.col, insertColumn, deleteColumn]
  )

  const renderCell = (rowIndex: number, colIndex: number, value: string, isHeader: boolean) => {
    const isSelected = selected.row === rowIndex && selected.col === colIndex
    const isEditing = isSelected && editingValue !== null
    const headerClass = isHeader ? ' sse-cell--header' : ''
    const selectedClass = isSelected ? ' sse-cell--selected' : ''
    return (
      <div
        key={colIndex}
        className={`sse-cell${headerClass}${selectedClass}`}
        style={styleByCol[colIndex]}
        onClick={() => setSelected({ row: rowIndex, col: colIndex })}
        onDoubleClick={() => { setSelected({ row: rowIndex, col: colIndex }); startEdit() }}
      >
        {isEditing && editingValue !== null ? (
          <input
            ref={inputRef}
            className="sse-cell-input"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => commitEdit(PostCommitMove.None)}
            onKeyDown={handleEditorKeyDown}
          />
        ) : (
          value
        )}
      </div>
    )
  }

  return (
    <div className="sse-root" data-testid={TEST_ID_ROOT}>
      <div className="sse-header">
        <div className="sse-title">Spreadsheet</div>
        <div className="sse-actions">
          <button className="sse-btn" onClick={() => onRowAction(RowAction.InsertAbove)}>Row above</button>
          <button className="sse-btn" onClick={() => onRowAction(RowAction.InsertBelow)}>Row below</button>
          <button className="sse-btn" onClick={() => onRowAction(RowAction.Delete)} disabled={selected.row === HEADER_ROW}>Delete row</button>
          <span className="sse-divider" />
          <button className="sse-btn" onClick={() => onColumnAction(ColumnAction.InsertLeft)}>Col left</button>
          <button className="sse-btn" onClick={() => onColumnAction(ColumnAction.InsertRight)}>Col right</button>
          <button className="sse-btn" onClick={() => onColumnAction(ColumnAction.Delete)} disabled={model.headers.length <= 1}>Delete col</button>
          <span className="sse-divider" />
          <button className="sse-btn" onClick={onCancel} data-testid={TEST_ID_CANCEL}>Cancel</button>
          <button className="sse-btn sse-btn--primary" onClick={handleApply} data-testid={TEST_ID_APPLY}>Apply</button>
        </div>
      </div>
      <div
        ref={gridRef}
        className="sse-grid"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
      >
        <div className="sse-row sse-row--align">
          <div className="sse-row-header" />
          {model.align.map((align, c) => (
            <button
              key={c}
              className="sse-align-toggle"
              title="Toggle column alignment"
              onClick={() => cycleColumnAlign(c)}
            >
              {alignSymbol(align)}
            </button>
          ))}
        </div>
        <div className="sse-row sse-row--header">
          <div className="sse-row-header">#</div>
          {model.headers.map((header, c) => renderCell(HEADER_ROW, c, header, true))}
        </div>
        {model.rows.map((row, rIdx) => (
          <div key={rIdx} className="sse-row">
            <div className="sse-row-header">{rIdx + 1}</div>
            {row.map((cell, c) => renderCell(rIdx, c, cell, false))}
          </div>
        ))}
      </div>
    </div>
  )
}
