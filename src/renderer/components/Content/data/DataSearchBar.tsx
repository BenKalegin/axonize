import { useCallback, useState } from 'react'
import type { DataSearchResult } from '@core/data/types'

interface DataSearchBarProps {
  filePath: string
  matchCount: number
  currentMatch: number
  onResult: (result: DataSearchResult) => void
  onNavigate: (delta: number) => void
}

/** Search input shared by the grid and tree data views; queries run in the main process. */
export function DataSearchBar({ filePath, matchCount, currentMatch, onResult, onNavigate }: DataSearchBarProps) {
  const [text, setText] = useState('')
  const [searching, setSearching] = useState(false)
  const [truncated, setTruncated] = useState(false)

  const runSearch = useCallback(async () => {
    if (!text.trim()) return
    setSearching(true)
    try {
      const result = await window.axonize.data.search(filePath, text)
      setTruncated(result.truncated)
      onResult(result)
    } finally {
      setSearching(false)
    }
  }, [filePath, text, onResult])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (matchCount > 0 && !searching) {
      onNavigate(e.shiftKey ? -1 : 1)
    } else {
      void runSearch()
    }
  }

  return (
    <div className="data-search-bar">
      <input
        className="data-search-input"
        placeholder="Search records… (Enter)"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onResult({ rowIndexes: [], nodePaths: [], truncated: false })
        }}
        onKeyDown={handleKeyDown}
      />
      <button className="toolbar-btn" disabled={searching || !text.trim()} onClick={() => void runSearch()}>
        {searching ? '…' : 'Find'}
      </button>
      {matchCount > 0 && (
        <>
          <span className="data-search-count">
            {currentMatch + 1} / {matchCount}
            {truncated ? '+' : ''}
          </span>
          <button className="toolbar-btn" onClick={() => onNavigate(-1)}>
            ↑
          </button>
          <button className="toolbar-btn" onClick={() => onNavigate(1)}>
            ↓
          </button>
        </>
      )}
    </div>
  )
}
