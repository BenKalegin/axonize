import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import elkLayouts from '@mermaid-js/layout-elk'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { splitSections, type MarkdownSection } from '@/lib/section-splitter'
import { SectionBlock } from './SectionBlock'
import { SectionInsert } from './SectionInsert'
import { ConflictDialog } from './ConflictDialog'

mermaid.registerLayoutLoaders(elkLayouts)
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  layout: 'elk',
  flowchart: { useMaxWidth: true },
  sequence: { useMaxWidth: true },
  gantt: { useMaxWidth: true },
  journey: { useMaxWidth: true },
  class: { useMaxWidth: true },
  state: { useMaxWidth: true },
  er: { useMaxWidth: true },
  pie: { useMaxWidth: true },
  architecture: { useMaxWidth: true }
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
  const {
    selectedFile,
    selectFile,
    presentationMode,
    presentationIndex,
    setPresentationTotal
  } = useEditorStore()
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
    [triggerReindex]
  )

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
    [selectedFile, writeSection]
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

  const handleInsert = useCallback(
    async (afterLine: number, headingLevel: number) => {
      if (!selectedFile) return
      const hashes = '#'.repeat(headingLevel)
      const newSection = `\n${hashes} New Section\n\n`

      const current = rawContentRef.current
      const lines = current.split('\n')
      const before = lines.slice(0, afterLine)
      const after = lines.slice(afterLine)
      const updated = [...before, newSection, ...after].join('\n')

      const fullContent = frontmatterRef.current + updated
      await window.axonize.file.write(selectedFile, fullContent)

      setRawContent(updated)
      setFileHash(hashSimple(fullContent))
      setSections(splitSections(updated))

      triggerReindex(selectedFile)
    },
    [selectedFile, triggerReindex]
  )

  // Group sections into slides: each heading + its trailing non-heading sections
  const slides = useMemo(() => {
    const result: MarkdownSection[][] = []
    for (const section of sections) {
      if (section.kind === 'heading') {
        result.push([section])
      } else if (result.length > 0) {
        result[result.length - 1].push(section)
      }
      // skip preamble/mermaid before any heading
    }
    return result
  }, [sections])

  useEffect(() => {
    setPresentationTotal(slides.length)
  }, [slides.length, setPresentationTotal])

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      if (href.startsWith('http://') || href.startsWith('https://'))
        return

      e.preventDefault()

      if (href.startsWith('#')) {
        if (selectedFile) selectFile(`${selectedFile}${href}`)
        return
      }

      const currentDir = selectedFile ? selectedFile.replace(/\/[^/]+$/, '') : vaultPath
      if (!currentDir) return

      const cleanHref = href.split('#')[0]
      if (!cleanHref) return

      const hash = href.includes('#') ? href.slice(href.indexOf('#')) : ''
      const target = cleanHref.endsWith('.md') ? cleanHref : `${cleanHref}.md`
      const fullPath = target.startsWith('/') ? target : `${currentDir}/${target}`

      selectFile(`${fullPath}${hash}`)
    },
    [selectedFile, vaultPath, selectFile]
  )

  if (presentationMode && slides.length > 0) {
    const ADJACENT_OPACITY = 0.12
    const clampedIndex = Math.min(presentationIndex, slides.length - 1)
    const currentSlide = slides[clampedIndex]
    const prevSlide = clampedIndex > 0 ? slides[clampedIndex - 1] : null
    const nextSlide = clampedIndex < slides.length - 1 ? slides[clampedIndex + 1] : null

    return (
      <div className="markdown-view presentation-mode" data-testid={TEST_IDS.MARKDOWN_VIEW}>
        {prevSlide && (
          <div className="presentation-adjacent presentation-adjacent--prev" style={{ opacity: ADJACENT_OPACITY }}>
            {prevSlide.map((s) => (
              <SectionBlock key={s.id} section={s} onSave={handleSave} onLinkClick={handleLinkClick} />
            ))}
          </div>
        )}
        <div className="presentation-current">
          {currentSlide.map((s) => (
            <SectionBlock key={s.id} section={s} onSave={handleSave} onLinkClick={handleLinkClick} />
          ))}
        </div>
        {nextSlide && (
          <div className="presentation-adjacent presentation-adjacent--next" style={{ opacity: ADJACENT_OPACITY }}>
            {nextSlide.map((s) => (
              <SectionBlock key={s.id} section={s} onSave={handleSave} onLinkClick={handleLinkClick} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="markdown-view" data-testid={TEST_IDS.MARKDOWN_VIEW}>
      {sections.length === 0 && (
        <SectionInsert afterLine={0} onInsert={handleInsert} />
      )}
      {sections.map((section, _) => (
        <React.Fragment key={section.id}>
          <SectionBlock
            section={section}
            onSave={handleSave}
            onLinkClick={handleLinkClick}
          />
          <SectionInsert
            afterLine={section.endLine}
            contextDepth={section.depth}
            onInsert={handleInsert}
          />
        </React.Fragment>
      ))}
      {conflict && (
        <ConflictDialog onOverride={handleConflictOverride} onReload={handleConflictReload} />
      )}
    </div>
  )
})
