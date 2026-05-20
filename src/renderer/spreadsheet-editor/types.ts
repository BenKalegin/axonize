export type ColumnAlign = 'left' | 'center' | 'right' | null

export interface GfmTableModel {
  headers: string[]
  rows: string[][]
  align: ColumnAlign[]
}

export interface CellAddress {
  row: number
  col: number
}

export const HEADER_ROW = -1
