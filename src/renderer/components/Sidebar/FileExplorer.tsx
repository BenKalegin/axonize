import { useState, useMemo } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useVaultStore } from '../../store/vault-store'
import { FileTreeNode } from './FileTreeNode'

export function FileExplorer() {
  const { fileTree, excludedFolders } = useVaultStore()
  const [hiddenExpanded, setHiddenExpanded] = useState(false)

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

  return (
    <div className="file-explorer" data-testid={TEST_IDS.FILE_EXPLORER}>
      <div className="sidebar-header">Files</div>
      <div className="file-tree" data-testid={TEST_IDS.FILE_TREE}>
        {visible.map((entry) => (
          <FileTreeNode key={entry.path} entry={entry} depth={0} />
        ))}
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
    </div>
  )
}
