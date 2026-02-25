import { useState } from 'react'
import { TEST_IDS } from '../../lib/testids'
import { useEditorStore } from '../../store/editor-store'

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
}

export function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const { selectedFile, selectFile } = useEditorStore()
  const isSelected = selectedFile === entry.path

  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded(!expanded)
    } else {
      selectFile(entry.path)
    }
  }

  return (
    <div data-testid={TEST_IDS.FILE_TREE_NODE} data-path={entry.relativePath}>
      <div
        className={`file-tree-node ${isSelected ? 'selected' : ''} ${entry.isDirectory ? 'directory' : 'file'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
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
      {entry.isDirectory && expanded && entry.children && (
        <div className="file-tree-children">
          {entry.children.map((child) => (
            <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
