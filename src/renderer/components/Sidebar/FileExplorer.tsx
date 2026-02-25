import { TEST_IDS } from '../../lib/testids'
import { useVaultStore } from '../../store/vault-store'
import { FileTreeNode } from './FileTreeNode'

export function FileExplorer() {
  const { fileTree } = useVaultStore()

  return (
    <div className="file-explorer" data-testid={TEST_IDS.FILE_EXPLORER}>
      <div className="sidebar-header">Files</div>
      <div className="file-tree" data-testid={TEST_IDS.FILE_TREE}>
        {fileTree.map((entry) => (
          <FileTreeNode key={entry.path} entry={entry} depth={0} />
        ))}
      </div>
    </div>
  )
}
