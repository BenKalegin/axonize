import { useGeneratedDocsStore } from '@/store/generated-docs-store'
import { useEditorStore } from '@/store/editor-store'
import { sanitizeFilename, ensureMarkdownExt } from '@/lib/filename'
import type { GeneratedDocMeta } from '@core/rag/types'
import { PromoteFileDialog } from './PromoteFileDialog'

interface MakePermanentDialogProps {
  doc: GeneratedDocMeta
  onClose: () => void
}

export function MakePermanentDialog({ doc, onClose }: MakePermanentDialogProps) {
  const { makePermanent } = useGeneratedDocsStore()
  const { selectFile } = useEditorStore()

  const onPromote = async (targetPath: string): Promise<void> => {
    await makePermanent(doc.filePath, targetPath)
    selectFile(targetPath)
  }

  return (
    <PromoteFileDialog
      defaultFilename={ensureMarkdownExt(sanitizeFilename(doc.title))}
      dialogTitle="Make Permanent"
      confirmLabel="Save"
      onPromote={onPromote}
      onClose={onClose}
    />
  )
}
