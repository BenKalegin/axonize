import { useState, useMemo, useCallback } from 'react'
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

export function FileExplorer() {
  const { fileTree, excludedFolders } = useVaultStore()
  const { canGoBack, canGoForward, goBack, goForward } = useEditorStore()
  const { docs } = useGeneratedDocsStore()
  const [hiddenExpanded, setHiddenExpanded] = useState(false)
  const [generatedExpanded, setGeneratedExpanded] = useState(true)
  const [permanentDoc, setPermanentDoc] = useState<GeneratedDocMeta | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
          autoFocus
        />
      )}
      <div className="file-tree" data-testid={TEST_IDS.FILE_TREE}>
        {filteredVisible.map((entry) => (
          <FileTreeNode key={entry.path} entry={entry} depth={0} defaultExpanded={!!searchQuery} />
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
              <FileTreeNode key={entry.path} entry={entry} depth={0} excluded />
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
