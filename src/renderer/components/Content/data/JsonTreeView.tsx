import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DataSearchResult, JsonNodeSummary } from '@core/data/types'
import { DataValueType } from '@core/data/types'
import { DataSearchBar } from './DataSearchBar'

const TREE_ROW_HEIGHT_PX = 26
const OVERSCAN_ROWS = 10
const MAX_TREE_CHILDREN = 500
const INDENT_PX = 18
const ROOT_KEY = ''
const PATH_SEPARATOR = '.'

interface JsonTreeViewProps {
  filePath: string
}

interface TreeRow {
  pathKey: string
  segments: string[]
  node: JsonNodeSummary
  depth: number
  isContainer: boolean
  /** Synthetic "…N more children" indicator row. */
  isTruncationNote?: boolean
}

/**
 * Virtualized collapsible tree over tree-shaped JSON. Only currently-expanded
 * nodes are flattened into the virtualized list; children load lazily via IPC.
 */
export function JsonTreeView({ filePath }: JsonTreeViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [childrenCache, setChildrenCache] = useState<Map<string, JsonNodeSummary[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [matches, setMatches] = useState<string[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)

  const loadChildren = useCallback(
    async (pathKey: string, segments: string[]): Promise<JsonNodeSummary[]> => {
      const nodes = await window.axonize.data.node(filePath, segments, 0, MAX_TREE_CHILDREN)
      setChildrenCache((prev) => new Map(prev).set(pathKey, nodes))
      return nodes
    },
    [filePath]
  )

  useEffect(() => {
    void loadChildren(ROOT_KEY, [])
  }, [loadChildren])

  const rows = useMemo(() => flattenVisible(childrenCache, expanded), [childrenCache, expanded])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TREE_ROW_HEIGHT_PX,
    overscan: OVERSCAN_ROWS
  })

  const toggleNode = useCallback(
    (row: TreeRow) => {
      if (!row.isContainer) return
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(row.pathKey)) next.delete(row.pathKey)
        else next.add(row.pathKey)
        return next
      })
      if (!childrenCache.has(row.pathKey)) void loadChildren(row.pathKey, row.segments)
    },
    [childrenCache, loadChildren]
  )

  const expandToPath = useCallback(
    async (pathKey: string) => {
      const segments = pathKey.split(PATH_SEPARATOR)
      let cache = childrenCache
      for (let depth = 0; depth < segments.length - 1; depth++) {
        const ancestorKey = segments.slice(0, depth + 1).join(PATH_SEPARATOR)
        if (!cache.has(ancestorKey)) {
          const nodes = await window.axonize.data.node(filePath, segments.slice(0, depth + 1), 0, MAX_TREE_CHILDREN)
          cache = new Map(cache).set(ancestorKey, nodes)
        }
        setExpanded((prev) => (prev.has(ancestorKey) ? prev : new Set(prev).add(ancestorKey)))
      }
      setChildrenCache(cache)
    },
    [childrenCache, filePath]
  )

  const jumpToMatch = useCallback(
    async (matchOrdinal: number, matchPaths: string[]) => {
      if (matchPaths.length === 0) return
      const wrapped = ((matchOrdinal % matchPaths.length) + matchPaths.length) % matchPaths.length
      setCurrentMatch(wrapped)
      await expandToPath(matchPaths[wrapped])
    },
    [expandToPath]
  )

  // Scroll to the current match once its ancestors are expanded and flattened in.
  useEffect(() => {
    if (currentMatch < 0) return
    const target = matches[currentMatch]
    const index = rows.findIndex((r) => r.pathKey === target)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' })
  }, [rows, matches, currentMatch, virtualizer])

  const handleSearch = useCallback(
    (result: DataSearchResult) => {
      setMatches(result.nodePaths)
      setCurrentMatch(-1)
      void jumpToMatch(0, result.nodePaths)
    },
    [jumpToMatch]
  )

  const highlightedPath = currentMatch >= 0 ? matches[currentMatch] : null

  return (
    <div className="json-tree">
      <DataSearchBar
        filePath={filePath}
        matchCount={matches.length}
        currentMatch={currentMatch}
        onResult={handleSearch}
        onNavigate={(delta) => void jumpToMatch(currentMatch + delta, matches)}
      />
      <div className="json-tree-scroll" ref={scrollRef}>
        <div className="json-tree-body" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index]
            return (
              <TreeRowView
                key={vRow.key}
                row={row}
                expanded={expanded.has(row.pathKey)}
                highlighted={row.pathKey === highlightedPath}
                top={vRow.start}
                onToggle={toggleNode}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface TreeRowViewProps {
  row: TreeRow
  expanded: boolean
  highlighted: boolean
  top: number
  onToggle: (row: TreeRow) => void
}

function TreeRowView({ row, expanded, highlighted, top, onToggle }: TreeRowViewProps) {
  const classes = ['json-tree-row']
  if (highlighted) classes.push('json-tree-row-match')
  if (row.isTruncationNote) classes.push('json-tree-row-note')

  return (
    <div
      className={classes.join(' ')}
      style={{ transform: `translateY(${top}px)`, paddingLeft: row.depth * INDENT_PX }}
      onClick={() => onToggle(row)}
    >
      <span className="json-tree-arrow">{row.isContainer ? (expanded ? '▾' : '▸') : ''}</span>
      <span className="json-tree-key">{row.node.key}</span>
      {renderNodeValue(row.node)}
    </div>
  )
}

function renderNodeValue(node: JsonNodeSummary) {
  if (node.type === DataValueType.Object || node.type === DataValueType.Array) {
    const braces = node.type === DataValueType.Array ? '[…]' : '{…}'
    return (
      <span className="json-tree-meta">
        {braces} {node.childCount}
      </span>
    )
  }
  const text = node.type === DataValueType.String ? `"${node.scalarValue}"` : String(node.scalarValue)
  return <span className={`json-tree-value json-tree-${node.type}`}>{text}</span>
}

function flattenVisible(cache: Map<string, JsonNodeSummary[]>, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = []
  appendChildren(rows, cache, expanded, ROOT_KEY, [], 0)
  return rows
}

function appendChildren(
  rows: TreeRow[],
  cache: Map<string, JsonNodeSummary[]>,
  expanded: Set<string>,
  parentKey: string,
  parentSegments: string[],
  depth: number
): void {
  const children = cache.get(parentKey)
  if (!children) return

  for (const node of children) {
    const segments = [...parentSegments, node.key]
    const pathKey = segments.join(PATH_SEPARATOR)
    const isContainer = node.type === DataValueType.Object || node.type === DataValueType.Array
    rows.push({ pathKey, segments, node, depth, isContainer })
    if (isContainer && expanded.has(pathKey)) {
      appendChildren(rows, cache, expanded, pathKey, segments, depth + 1)
      appendTruncationNote(rows, cache, node, pathKey, segments, depth)
    }
  }
}

function appendTruncationNote(
  rows: TreeRow[],
  cache: Map<string, JsonNodeSummary[]>,
  node: JsonNodeSummary,
  pathKey: string,
  segments: string[],
  depth: number
): void {
  const loaded = cache.get(pathKey)
  if (!loaded || node.childCount === undefined || loaded.length >= node.childCount) return
  rows.push({
    pathKey: `${pathKey}${PATH_SEPARATOR}(more)`,
    segments,
    node: {
      key: `… ${node.childCount - loaded.length} more (showing first ${loaded.length})`,
      type: DataValueType.Null
    },
    depth: depth + 1,
    isContainer: false,
    isTruncationNote: true
  })
}
