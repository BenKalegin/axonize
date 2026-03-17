import React, { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import elkLayouts from '@mermaid-js/layout-elk'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { splitSections, type MarkdownSection } from '@/lib/section-splitter'
import { SectionBlock } from './SectionBlock'
import { ConflictDialog } from './ConflictDialog'

mermaid.registerLayoutLoaders(elkLayouts)
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  layout: 'elk',
  flowchart: { useMaxWidth: false },
  sequence: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
  journey: { useMaxWidth: false },
  class: { useMaxWidth: false },
  state: { useMaxWidth: false },
  er: { useMaxWidth: false },
  pie: { useMaxWidth: false },
  architecture: { useMaxWidth: false }
})

declare global {
  interface Window {
    axonize: import('../../../preload').AxonizeAPI
  }
}

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/

function hashSimple(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

export const MarkdownView = React.memo(function MarkdownView() {
  const { selectedFile, selectFile } = useEditorStore()
  const { vaultPath, fileTree } = useVaultStore()

  const [sections, setSections] = useState<MarkdownSection[]>([])
  const [rawContent, setRawContent] = useState('')
  const [frontmatter, setFrontmatter] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [conflict, setConflict] = useState<{ sectionId: string; newMarkdown: string } | null>(null)

  const rawContentRef = useRef(rawContent)
  rawContentRef.current = rawContent
  const fileHashRef = useRef(fileHash)
  fileHashRef.current = fileHash
  const frontmatterRef = useRef(frontmatter)
  frontmatterRef.current = frontmatter

  const loadFile = useCallback(async (filePath: string) => {
    const content = await window.axonize.file.read(filePath)
    const fmMatch = content.match(FRONTMATTER_RE)
    const fm = fmMatch ? fmMatch[0] : ''
    const stripped = fm ? content.slice(fm.length) : content
    const hash = hashSimple(content)

    setFrontmatter(fm)
    setRawContent(stripped)
    setFileHash(hash)
    setSections(splitSections(stripped))
  }, [])

  useEffect(() => {
    if (!selectedFile) return
    let cancelled = false
    loadFile(selectedFile).then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [selectedFile, fileTree, loadFile])

  const handleSave = useCallback(
    async (sectionId: string, newMarkdown: string) => {
      if (!selectedFile) return

      const diskContent = await window.axonize.file.read(selectedFile)
      const diskHash = hashSimple(diskContent)

      if (diskHash !== fileHashRef.current) {
        setConflict({ sectionId, newMarkdown })
        return
      }

      await writeSection(selectedFile, sectionId, newMarkdown)
    },
    [selectedFile]
  )

  const writeSection = useCallback(
    async (filePath: string, sectionId: string, newMarkdown: string) => {
      const current = rawContentRef.current
      const lines = current.split('\n')

      const sec = splitSections(current).find((s) => s.id === sectionId)
      if (!sec) return

      const before = lines.slice(0, sec.startLine - 1)
      const after = lines.slice(sec.endLine)
      const updated = [...before, newMarkdown, ...after].join('\n')

      const fullContent = frontmatterRef.current + updated
      await window.axonize.file.write(filePath, fullContent)

      setRawContent(updated)
      setFileHash(hashSimple(fullContent))
      setSections(splitSections(updated))

      triggerReindex(filePath)
    },
    []
  )

  const triggerReindex = useCallback(
    (filePath: string) => {
      if (!vaultPath) return
      const relative = filePath.startsWith(vaultPath)
        ? filePath.slice(vaultPath.length + 1)
        : filePath
      window.axonize.rag.reindexFile(vaultPath, relative).catch(() => {})
      window.axonize.semantic.incremental(vaultPath).catch(() => {})
    },
    [vaultPath]
  )

  const handleConflictOverride = useCallback(async () => {
    if (!conflict || !selectedFile) return
    await writeSection(selectedFile, conflict.sectionId, conflict.newMarkdown)
    setConflict(null)
  }, [conflict, selectedFile, writeSection])

  const handleConflictReload = useCallback(async () => {
    if (!selectedFile) return
    await loadFile(selectedFile)
    setConflict(null)
  }, [selectedFile, loadFile])

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#'))
        return

      e.preventDefault()

      const currentDir = selectedFile ? selectedFile.replace(/\/[^/]+$/, '') : vaultPath
      if (!currentDir) return

      const cleanHref = href.split('#')[0]
      if (!cleanHref) return

      const target = cleanHref.endsWith('.md') ? cleanHref : `${cleanHref}.md`
      const fullPath = target.startsWith('/') ? target : `${currentDir}/${target}`

      selectFile(fullPath)
    },
    [selectedFile, vaultPath, selectFile]
  )

  return (
    <div className="markdown-view" data-testid={TEST_IDS.MARKDOWN_VIEW}>
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          onSave={handleSave}
          onLinkClick={handleLinkClick}
        />
      ))}
      {conflict && (
        <ConflictDialog onOverride={handleConflictOverride} onReload={handleConflictReload} />
      )}
    </div>
  )
})
