import { useState, useCallback, useEffect, useRef } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { useVaultStore } from '../../store/vault-store'

interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileEntry[]
}

interface FileTreeNodeProps {
  entry: FileEntry
  depth: number
  excluded?: boolean
  isExpanded: (path: string) => boolean
  onToggle: (path: string) => void
  focusedPath: string | null
  onSelect?: (path: string) => void
  getDisplayName?: (entry: FileEntry) => string
}

export function FileTreeNode({ entry, depth, excluded, isExpanded, onToggle, focusedPath, onSelect, getDisplayName }: FileTreeNodeProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const { selectedFile, selectFile } = useEditorStore()
  const { excludeFolder, includeFolder, excludedFolders } = useVaultStore()
  const isSelected = selectedFile === entry.path
  const isExcluded = excluded || excludedFolders.includes(entry.relativePath)
  const expanded = entry.isDirectory && isExpanded(entry.path)
  const focused = focusedPath === entry.path

  useEffect(() => {
    if (focused && nodeRef.current) {
      nodeRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [focused])

  const handleClick = () => {
    onSelect?.(entry.path)
    if (entry.isDirectory) {
      onToggle(entry.path)
    } else {
      selectFile(entry.path)
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!entry.isDirectory) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [entry.isDirectory])

  useEffect(() => {
    if (!ctxMenu) return
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [ctxMenu])

  const handleExclude = () => {
    excludeFolder(entry.relativePath)
    setCtxMenu(null)
  }

  const handleInclude = () => {
    includeFolder(entry.relativePath)
    setCtxMenu(null)
  }

  return (
    <div data-testid={TEST_IDS.FILE_TREE_NODE} data-path={entry.relativePath}>
      <div
        ref={nodeRef}
        className={`file-tree-node ${isSelected ? 'selected' : ''} ${focused ? 'focused' : ''} ${entry.isDirectory ? 'directory' : 'file'}${isExcluded ? ' excluded' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span
          className={`toggle ${expanded ? 'expanded' : ''}`}
          data-testid={TEST_IDS.FILE_TREE_NODE_TOGGLE}
        >
          {entry.isDirectory && (
            <svg width="10" height="10" viewBox="0 0 8 8" fill="none">
              <path
                d={expanded ? 'M1 2.5L4 5.5L7 2.5' : 'M2.5 1L5.5 4L2.5 7'}
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span data-testid={TEST_IDS.FILE_TREE_NODE_LABEL} className="file-name">
          {getDisplayName ? getDisplayName(entry) : entry.name}
        </span>
      </div>
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="context-menu"
          data-testid={TEST_IDS.CONTEXT_MENU}
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000 }}
        >
          {isExcluded ? (
            <button
              className="context-menu-item"
              data-testid={TEST_IDS.INCLUDE_FOLDER_BTN}
              onClick={handleInclude}
            >
              Include in vault
            </button>
          ) : (
            <button
              className="context-menu-item"
              data-testid={TEST_IDS.EXCLUDE_FOLDER_BTN}
              onClick={handleExclude}
            >
              Exclude from vault
            </button>
          )}
        </div>
      )}
      {expanded && entry.children && (
        <div
          className="file-tree-children"
          style={{ '--indent-guide-left': `${depth * 20 + 15}px` } as React.CSSProperties}
        >
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              excluded={isExcluded}
              isExpanded={isExpanded}
              onToggle={onToggle}
              focusedPath={focusedPath}
              onSelect={onSelect}
              getDisplayName={getDisplayName}
            />
          ))}
        </div>
      )}
    </div>
  )
}
