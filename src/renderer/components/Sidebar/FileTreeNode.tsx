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
}

export function FileTreeNode({ entry, depth, excluded }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)
  const { selectedFile, selectFile } = useEditorStore()
  const { excludeFolder, includeFolder, excludedFolders } = useVaultStore()
  const isSelected = selectedFile === entry.path
  const isExcluded = excluded || excludedFolders.includes(entry.relativePath)

  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded(!expanded)
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
        className={`file-tree-node ${isSelected ? 'selected' : ''} ${entry.isDirectory ? 'directory' : 'file'}${isExcluded ? ' excluded' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {entry.isDirectory && (
          <span
            className={`toggle ${expanded ? 'expanded' : ''}`}
            data-testid={TEST_IDS.FILE_TREE_NODE_TOGGLE}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d={expanded ? 'M1 3L5 7L9 3' : 'M3 1L7 5L3 9'} />
            </svg>
          </span>
        )}
        <span data-testid={TEST_IDS.FILE_TREE_NODE_LABEL} className="file-name">
          {entry.name}
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
      {entry.isDirectory && expanded && entry.children && (
        <div className="file-tree-children">
          {entry.children.map((child) => (
            <FileTreeNode key={child.path} entry={child} depth={depth + 1} excluded={isExcluded} />
          ))}
        </div>
      )}
    </div>
  )
}
