import { useState, useCallback, useEffect, useRef } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'
import { useGeneratedDocsStore } from '../../store/generated-docs-store'
import type { GeneratedDocMeta } from '../../../core/rag/types'

interface GeneratedDocNodeProps {
  doc: GeneratedDocMeta
  onMakePermanent: (doc: GeneratedDocMeta) => void
}

export function GeneratedDocNode({ doc, onMakePermanent }: GeneratedDocNodeProps) {
  const { selectedFile, selectFile } = useEditorStore()
  const { renameDoc, deleteDoc } = useGeneratedDocsStore()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(doc.title)
  const ctxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSelected = selectedFile === doc.filePath

  const handleClick = () => selectFile(doc.filePath)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

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

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming])

  const handleRename = () => {
    setCtxMenu(null)
    setRenameValue(doc.title)
    setRenaming(true)
  }

  const commitRename = async () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== doc.title) {
      await renameDoc(doc.filePath, trimmed)
    }
    setRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setRenaming(false)
  }

  const handleDelete = async () => {
    setCtxMenu(null)
    await deleteDoc(doc.filePath)
  }

  const handleMakePermanent = () => {
    setCtxMenu(null)
    onMakePermanent(doc)
  }

  return (
    <div data-testid={TEST_IDS.GENERATED_DOC_NODE}>
      <div
        className={`file-tree-node generated-doc-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: '24px' }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {renaming ? (
          <input
            ref={inputRef}
            className="generated-doc-rename-input"
            data-testid={TEST_IDS.GENERATED_DOC_RENAME_INPUT}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-name generated-doc-name" data-testid={TEST_IDS.FILE_TREE_NODE_LABEL}>
            {doc.title}
          </span>
        )}
      </div>
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="context-menu"
          data-testid={TEST_IDS.CONTEXT_MENU}
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000 }}
        >
          <button className="context-menu-item" data-testid={TEST_IDS.GENERATED_DOC_RENAME_BTN} onClick={handleRename}>
            Rename
          </button>
          <button className="context-menu-item" data-testid={TEST_IDS.GENERATED_DOC_PERMANENT_BTN} onClick={handleMakePermanent}>
            Make Permanent
          </button>
          <button className="context-menu-item" data-testid={TEST_IDS.GENERATED_DOC_DELETE_BTN} onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
