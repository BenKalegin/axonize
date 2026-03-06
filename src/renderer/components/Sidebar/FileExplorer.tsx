import { useState, useMemo, useCallback, useRef } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useVaultStore } from '@/store/vault-store'
import { useEditorStore } from '@/store/editor-store'
import { useGeneratedDocsStore } from '@/store/generated-docs-store'
import { FileTreeNode } from './FileTreeNode'
import { GeneratedDocNode } from './GeneratedDocNode'
import { MakePermanentDialog } from './MakePermanentDialog'
import type { GeneratedDocMeta } from '@core/rag/types'

interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileEntry[]
}

function filterTree(entries: FileEntry[], query: string): FileEntry[] {
  const lower = query.toLowerCase()
  const result: FileEntry[] = []
  for (const entry of entries) {
    if (entry.isDirectory) {
      const filteredChildren = entry.children ? filterTree(entry.children, query) : []
      if (filteredChildren.length > 0) {
        result.push({ ...entry, children: filteredChildren })
      }
    } else if (entry.name.toLowerCase().includes(lower)) {
      result.push(entry)
    }
  }
  return result
}

function flattenTree(entries: FileEntry[], isExpanded: (path: string) => boolean): FileEntry[] {
  const result: FileEntry[] = []
  for (const entry of entries) {
    result.push(entry)
    if (entry.isDirectory && isExpanded(entry.path) && entry.children) {
      result.push(...flattenTree(entry.children, isExpanded))
    }
  }
  return result
}

function buildParentMap(entries: FileEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(items: FileEntry[], parentPath: string | null): void {
    for (const entry of items) {
      if (parentPath) map.set(entry.path, parentPath)
      if (entry.isDirectory && entry.children) {
        walk(entry.children, entry.path)
      }
    }
  }
  walk(entries, null)
  return map
}

export function FileExplorer() {
  const { fileTree, excludedFolders } = useVaultStore()
  const { selectedFile, selectFile, canGoBack, canGoForward, goBack, goForward } = useEditorStore()
  const { docs } = useGeneratedDocsStore()
  const [hiddenExpanded, setHiddenExpanded] = useState(false)
  const [generatedExpanded, setGeneratedExpanded] = useState(true)
  const [permanentDoc, setPermanentDoc] = useState<GeneratedDocMeta | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const { visible, excluded } = useMemo(() => {
    const excludedSet = new Set(excludedFolders)
    const vis: typeof fileTree = []
    const exc: typeof fileTree = []
    for (const entry of fileTree) {
      if (entry.isDirectory && excludedSet.has(entry.relativePath)) {
        exc.push(entry)
      } else {
        vis.push(entry)
      }
    }
    return { visible: vis, excluded: exc }
  }, [fileTree, excludedFolders])

  const filteredVisible = useMemo(() => {
    if (!searchQuery) return visible
    return filterTree(visible as FileEntry[], searchQuery)
  }, [visible, searchQuery])

  const isExpanded = useCallback((path: string): boolean => {
    if (searchQuery) return true
    return !collapsedPaths.has(path)
  }, [searchQuery, collapsedPaths])

  const handleToggle = useCallback((path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleNodeSelect = useCallback((path: string) => {
    setFocusedPath(path)
  }, [])

  const flatItems = useMemo(() => {
    return flattenTree(filteredVisible as FileEntry[], isExpanded)
  }, [filteredVisible, isExpanded])

  const parentMap = useMemo(() => {
    return buildParentMap(filteredVisible as FileEntry[])
  }, [filteredVisible])

  const handleTreeFocus = useCallback(() => {
    if (!focusedPath || !flatItems.some(i => i.path === focusedPath)) {
      const sel = flatItems.find(i => i.path === selectedFile)
      setFocusedPath(sel?.path ?? flatItems[0]?.path ?? null)
    }
  }, [focusedPath, flatItems, selectedFile])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return

    let idx = flatItems.findIndex(item => item.path === focusedPath)
    if (idx < 0) idx = 0

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const next = Math.min(idx + 1, flatItems.length - 1)
        setFocusedPath(flatItems[next].path)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev = Math.max(idx - 1, 0)
        setFocusedPath(flatItems[prev].path)
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        const item = flatItems[idx]
        if (item.isDirectory) {
          if (collapsedPaths.has(item.path)) {
            handleToggle(item.path)
          } else if (idx + 1 < flatItems.length) {
            setFocusedPath(flatItems[idx + 1].path)
          }
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const item = flatItems[idx]
        if (item.isDirectory && !collapsedPaths.has(item.path) && !searchQuery) {
          handleToggle(item.path)
        } else {
          const parent = parentMap.get(item.path)
          if (parent) setFocusedPath(parent)
        }
        break
      }
      case 'Enter': {
        e.preventDefault()
        const item = flatItems[idx]
        if (item.isDirectory) {
          handleToggle(item.path)
        } else {
          selectFile(item.path)
        }
        break
      }
    }
  }, [flatItems, focusedPath, collapsedPaths, handleToggle, searchQuery, parentMap, selectFile])

  const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (NAVIGATION_KEYS.has(e.key)) {
      if (!focusedPath || !flatItems.some(i => i.path === focusedPath)) {
        const sel = flatItems.find(i => i.path === selectedFile)
        setFocusedPath(sel?.path ?? flatItems[0]?.path ?? null)
      }
      handleKeyDown(e)
    } else if (e.key === 'Escape') {
      setSearchQuery('')
      setSearchOpen(false)
    }
  }, [handleKeyDown, focusedPath, flatItems, selectedFile])

  const handleMakePermanent = useCallback((doc: GeneratedDocMeta) => {
    setPermanentDoc(doc)
  }, [])

  return (
    <div className="file-explorer" data-testid={TEST_IDS.FILE_EXPLORER}>
      <div className="sidebar-header">
        <div className="nav-buttons">
          <button
            className="toolbar-btn nav-btn"
            onClick={goBack}
            disabled={!canGoBack}
            title="Go back"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 1L3 6L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="toolbar-btn nav-btn"
            onClick={goForward}
            disabled={!canGoForward}
            title="Go forward"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 1L9 6L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <span>Files</span>
        <button
          className="toolbar-btn nav-btn file-search-btn"
          onClick={() => {
            setSearchOpen(!searchOpen)
            if (searchOpen) setSearchQuery('')
          }}
          title="Search files"
          data-testid={TEST_IDS.FILE_SEARCH_BTN}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 8L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      {searchOpen && (
        <input
          className="file-search-input"
          data-testid={TEST_IDS.FILE_SEARCH_INPUT}
          type="text"
          placeholder="Filter files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          autoFocus
        />
      )}
      <div
        ref={treeRef}
        className="file-tree"
        data-testid={TEST_IDS.FILE_TREE}
        tabIndex={0}
        onFocus={handleTreeFocus}
        onKeyDown={handleKeyDown}
      >
        {filteredVisible.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            isExpanded={isExpanded}
            onToggle={handleToggle}
            focusedPath={focusedPath}
            onSelect={handleNodeSelect}
          />
        ))}
        {docs.length > 0 && (
          <>
            <div
              className="hidden-folders-header generated-docs-header"
              data-testid={TEST_IDS.GENERATED_DOCS_HEADER}
              onClick={() => setGeneratedExpanded(!generatedExpanded)}
            >
              <span className={`toggle ${generatedExpanded ? 'expanded' : ''}`}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d={generatedExpanded ? 'M1 3L5 7L9 3' : 'M3 1L7 5L3 9'} />
                </svg>
              </span>
              <span>Generated ({docs.length})</span>
            </div>
            {generatedExpanded && docs.map((doc) => (
              <GeneratedDocNode key={doc.id} doc={doc} onMakePermanent={handleMakePermanent} />
            ))}
          </>
        )}
        {excluded.length > 0 && (
          <>
            <div
              className="hidden-folders-header"
              data-testid={TEST_IDS.HIDDEN_FOLDERS_HEADER}
              onClick={() => setHiddenExpanded(!hiddenExpanded)}
            >
              <span className={`toggle ${hiddenExpanded ? 'expanded' : ''}`}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d={hiddenExpanded ? 'M1 3L5 7L9 3' : 'M3 1L7 5L3 9'} />
                </svg>
              </span>
              <span>Hidden ({excluded.length})</span>
            </div>
            {hiddenExpanded && excluded.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                excluded
                isExpanded={isExpanded}
                onToggle={handleToggle}
                focusedPath={null}
                onSelect={handleNodeSelect}
              />
            ))}
          </>
        )}
      </div>
      {permanentDoc && (
        <MakePermanentDialog doc={permanentDoc} onClose={() => setPermanentDoc(null)} />
      )}
    </div>
  )
}
