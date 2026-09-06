import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyFindHighlights,
  clearFindHighlights,
  findMatchRanges,
  scrollToMatch
} from '@/lib/find-in-content'

interface FindInFileBarProps {
  container: HTMLElement | null
  // Bump (e.g. raw markdown text) so matches recompute after content edits.
  contentVersion: string
  onClose: () => void
}

export function FindInFileBar({ container, contentVersion, onClose }: FindInFileBarProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rangesRef = useRef<Range[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    return clearFindHighlights
  }, [])

  useEffect(() => {
    if (!container) return
    const ranges = findMatchRanges(container, query)
    rangesRef.current = ranges
    setMatchCount(ranges.length)
    setActiveIndex(0)
    applyFindHighlights(ranges, 0)
    if (ranges.length > 0) scrollToMatch(ranges[0])
  }, [container, query, contentVersion])

  const navigate = useCallback(
    (delta: number) => {
      const ranges = rangesRef.current
      if (ranges.length === 0) return
      setActiveIndex((prev) => {
        const next = (prev + delta + ranges.length) % ranges.length
        applyFindHighlights(ranges, next)
        scrollToMatch(ranges[next])
        return next
      })
    },
    []
  )

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      navigate(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Global next/prev shortcuts while the bar is open: F3 / Shift+F3 and Cmd/Ctrl+G / Shift+Cmd/Ctrl+G
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F3' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g')) {
        e.preventDefault()
        navigate(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown)
    return () => window.removeEventListener('keydown', onGlobalKeyDown)
  }, [navigate, onClose])

  return (
    <div className="find-in-file-bar">
      <input
        ref={inputRef}
        className="data-search-input find-in-file-input"
        placeholder="Find in file…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="find-in-file-count">
        {query ? `${matchCount === 0 ? 0 : activeIndex + 1}/${matchCount}` : ''}
      </span>
      <span className="find-in-file-divider" />
      <button className="toolbar-btn" title="Previous match (Shift+Enter, Shift+F3, ⇧⌘G)" disabled={matchCount === 0} onClick={() => navigate(-1)}>
        ↑
      </button>
      <button className="toolbar-btn" title="Next match (Enter, F3, ⌘G)" disabled={matchCount === 0} onClick={() => navigate(1)}>
        ↓
      </button>
      <span className="find-in-file-divider" />
      <button className="toolbar-btn" title="Close (Esc)" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}
