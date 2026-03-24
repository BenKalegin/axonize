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

// --- Icon components ---

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4S1 6 1 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 1.5l9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3 4.5C2 5.5 1 6 1 6s2 4 5 4c.8 0 1.6-.3 2.2-.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5.2c-.1.2-.2.5-.2.8 0 .7.5 1.2 1.2 1.2.3 0 .6-.1.8-.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function RenameIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M4.5 3V2h3v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
    </svg>
  )
}

// --- Inline edit input (uncontrolled to avoid React state timing issues) ---

interface InlineEditProps {
  defaultValue: string
  placeholder: string
  testId: string
  depth: number
  onCommit: (value: string) => void
  onCancel: () => void
}

function InlineEdit({ defaultValue, placeholder, testId, depth, onCommit, onCancel }: InlineEditProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    // Focus + select on mount
    const input = inputRef.current
    if (input) {
      input.focus()
      input.select()
    }
  }, [])

  const doCommit = useCallback(() => {
    if (committedRef.current) return
    committedRef.current = true
    const val = inputRef.current?.value.trim() ?? ''
    if (val && val !== defaultValue) {
      onCommit(val)
    } else {
      onCancel()
    }
  }, [defaultValue, onCommit, onCancel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Swallow ALL keyboard events so the tree never sees them
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      doCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      committedRef.current = true
      onCancel()
    }
  }, [doCommit, onCancel])

  return (
    <div
      className="file-tree-node new-doc-input-row"
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      <span className="toggle" />
      <input
        ref={inputRef}
        className="new-doc-inline-input"
        data-testid={testId}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onBlur={doCommit}
      />
    </div>
  )
}

// --- Main component ---

type EditMode = null | { kind: 'rename' } | { kind: 'newDoc' }

export function FileTreeNode({ entry, depth, excluded, isExpanded, onToggle, focusedPath, onSelect, getDisplayName }: FileTreeNodeProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
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
    e.preventDefault()
    e.stopPropagation()
    setActionsOpen(true)
  }, [])

  useEffect(() => {
    if (!actionsOpen) return
    const close = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [actionsOpen])

  const closeMenu = () => setActionsOpen(false)

  const handleExclude = () => { excludeFolder(entry.relativePath); closeMenu() }
  const handleInclude = () => { includeFolder(entry.relativePath); closeMenu() }

  const handleNewDoc = () => {
    closeMenu()
    if (!expanded) onToggle(entry.path)
    setEditMode({ kind: 'newDoc' })
  }

  const handleRename = () => {
    closeMenu()
    setEditMode({ kind: 'rename' })
  }

  const handleDelete = async () => {
    closeMenu()
    try {
      await window.axonize.file.delete(entry.path)
      if (selectedFile === entry.path) selectFile('')
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  const commitRename = useCallback(async (newName: string) => {
    const dir = entry.path.replace(/\/[^/]+$/, '')
    const newPath = `${dir}/${newName}`
    try {
      await window.axonize.file.rename(entry.path, newPath)
      if (selectedFile === entry.path) selectFile(newPath)
    } catch (e) {
      console.error('Rename failed:', e)
    }
    setEditMode(null)
  }, [entry.path, selectedFile, selectFile])

  const commitNewDoc = useCallback(async (name: string) => {
    const fileName = name.endsWith('.md') ? name : `${name}.md`
    const filePath = `${entry.path}/${fileName}`
    try {
      await window.axonize.file.write(filePath, `# ${name.replace(/\.md$/, '')}\n`)
      selectFile(filePath)
    } catch (e) {
      console.error('Create doc failed:', e)
    }
    setEditMode(null)
  }, [entry.path, selectFile])

  const cancelEdit = useCallback(() => setEditMode(null), [])

  // --- Render ---

  const isRenaming = editMode?.kind === 'rename'
  const isCreating = editMode?.kind === 'newDoc'

  return (
    <div data-testid={TEST_IDS.FILE_TREE_NODE} data-path={entry.relativePath}>
      {isRenaming ? (
        <InlineEdit
          defaultValue={entry.name}
          placeholder="File name"
          testId={TEST_IDS.RENAME_FILE_INPUT}
          depth={depth}
          onCommit={commitRename}
          onCancel={cancelEdit}
        />
      ) : (
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
          <div className="folder-actions-wrapper" ref={actionsRef}>
            <button
              className="folder-actions-btn"
              data-testid={entry.isDirectory ? TEST_IDS.FOLDER_ACTIONS_BTN : TEST_IDS.FILE_ACTIONS_BTN}
              title="Actions"
              onClick={(e) => {
                e.stopPropagation()
                setActionsOpen(!actionsOpen)
              }}
            >
              <DotsIcon />
            </button>
            {actionsOpen && (
              <div
                className="folder-actions-menu"
                data-testid={entry.isDirectory ? TEST_IDS.FOLDER_ACTIONS_MENU : TEST_IDS.FILE_ACTIONS_MENU}
              >
                {entry.isDirectory ? (
                  <FolderMenu
                    isExcluded={isExcluded}
                    onNewDoc={handleNewDoc}
                    onExclude={handleExclude}
                    onInclude={handleInclude}
                  />
                ) : (
                  <FileMenu
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {isCreating && (
        <InlineEdit
          defaultValue="Untitled"
          placeholder="Document name"
          testId={TEST_IDS.NEW_DOC_INPUT}
          depth={depth + 1}
          onCommit={commitNewDoc}
          onCancel={cancelEdit}
        />
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

// --- Sub-menus ---

function FolderMenu({ isExcluded, onNewDoc, onExclude, onInclude }: {
  isExcluded: boolean
  onNewDoc: () => void
  onExclude: () => void
  onInclude: () => void
}) {
  return (
    <>
      {!isExcluded && (
        <button className="context-menu-item" data-testid={TEST_IDS.NEW_DOC_BTN} onClick={stopAndCall(onNewDoc)}>
          <PlusIcon /> New document
        </button>
      )}
      {isExcluded ? (
        <button className="context-menu-item" data-testid={TEST_IDS.INCLUDE_FOLDER_BTN} onClick={stopAndCall(onInclude)}>
          <EyeIcon /> Include in vault
        </button>
      ) : (
        <button className="context-menu-item" data-testid={TEST_IDS.EXCLUDE_FOLDER_BTN} onClick={stopAndCall(onExclude)}>
          <EyeOffIcon /> Exclude from vault
        </button>
      )}
    </>
  )
}

function FileMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <>
      <button className="context-menu-item" data-testid={TEST_IDS.RENAME_FILE_BTN} onClick={stopAndCall(onRename)}>
        <RenameIcon /> Rename
      </button>
      <button className="context-menu-item context-menu-item--danger" data-testid={TEST_IDS.DELETE_FILE_BTN} onClick={stopAndCall(onDelete)}>
        <DeleteIcon /> Delete
      </button>
    </>
  )
}

function stopAndCall(fn: () => void) {
  return (e: React.MouseEvent) => { e.stopPropagation(); fn() }
}
