import { useState, useEffect, useCallback } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useVaultStore } from '@/store/vault-store'
import { ensureMarkdownExt } from '@/lib/filename'

interface PromoteFileDialogProps {
  defaultFilename: string
  dialogTitle: string
  confirmLabel: string
  onPromote: (targetPath: string) => Promise<void>
  onClose: () => void
}

export function PromoteFileDialog({
  defaultFilename,
  dialogTitle,
  confirmLabel,
  onPromote,
  onClose
}: PromoteFileDialogProps) {
  const { vaultPath, loadFileTree } = useVaultStore()
  const [folders, setFolders] = useState<string[]>(['.'])
  const [selectedFolder, setSelectedFolder] = useState('.')
  const [filename, setFilename] = useState(defaultFilename)

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

  const handleSave = async (): Promise<void> => {
    if (!vaultPath || !filename.trim()) return
    const normalizedFilename = ensureMarkdownExt(filename)
    const targetPath = selectedFolder === '.'
      ? `${vaultPath}/${normalizedFilename}`
      : `${vaultPath}/${selectedFolder}/${normalizedFilename}`

    await onPromote(targetPath)
    await loadFileTree(vaultPath)
    onClose()
  }

  return (
    <div
      className="settings-overlay"
      data-testid={TEST_IDS.PROMOTE_FILE_DIALOG}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="settings-dialog make-permanent-dialog">
        <div className="settings-header">
          <span>{dialogTitle}</span>
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
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
