import { useState, useEffect, useCallback } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useVaultStore } from '../../store/vault-store'
import { useGeneratedDocsStore } from '../../store/generated-docs-store'
import { useEditorStore } from '../../store/editor-store'
import type { GeneratedDocMeta } from '../../../core/rag/types'

interface MakePermanentDialogProps {
  doc: GeneratedDocMeta
  onClose: () => void
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
}

export function MakePermanentDialog({ doc, onClose }: MakePermanentDialogProps) {
  const { vaultPath, loadFileTree } = useVaultStore()
  const { makePermanent } = useGeneratedDocsStore()
  const { selectFile } = useEditorStore()
  const [folders, setFolders] = useState<string[]>(['.'])
  const [selectedFolder, setSelectedFolder] = useState('.')
  const [filename, setFilename] = useState(sanitizeFilename(doc.title) + '.md')

  useEffect(() => {
    if (!vaultPath) return
    window.axonize.generatedDocs.listFolders(vaultPath).then(setFolders)
  }, [vaultPath])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSave = async () => {
    if (!vaultPath || !filename.trim()) return
    const normalizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`
    const targetPath = selectedFolder === '.'
      ? `${vaultPath}/${normalizedFilename}`
      : `${vaultPath}/${selectedFolder}/${normalizedFilename}`

    await makePermanent(doc.filePath, targetPath)
    if (vaultPath) await loadFileTree(vaultPath)
    selectFile(targetPath)
    onClose()
  }

  return (
    <div
      className="settings-overlay"
      data-testid={TEST_IDS.MAKE_PERMANENT_DIALOG}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="settings-dialog make-permanent-dialog">
        <div className="settings-header">
          <span>Make Permanent</span>
          <button className="settings-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="settings-body">
          <div className="settings-field">
            <label>Folder</label>
            <select
              className="settings-select"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
            >
              {folders.map((f) => (
                <option key={f} value={f}>{f === '.' ? '/ (vault root)' : f}</option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label>Filename</label>
            <input
              className="settings-input"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              autoFocus
            />
          </div>
        </div>
        <div className="settings-footer">
          <button className="toolbar-btn" onClick={onClose}>Cancel</button>
          <button className="toolbar-btn active" onClick={handleSave} disabled={!filename.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
