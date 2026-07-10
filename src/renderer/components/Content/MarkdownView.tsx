import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import elkLayouts from '@mermaid-js/layout-elk'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore, ViewMode, selectedFilePath } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { useGraphStore } from '@/store/graph-store'
import { splitSections, type MarkdownSection } from '@/lib/section-splitter'
import { handleCodeFileReferenceClick, isDocLink, resolveDocLink } from '@/lib/doc-link'
import { SectionBlock } from './SectionBlock'
import { SectionInsert } from './SectionInsert'
import { ConflictDialog } from './ConflictDialog'
import { FindInFileBar } from './FindInFileBar'
import { FrontmatterTable } from './FrontmatterTable'

mermaid.registerLayoutLoaders(elkLayouts)
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose', // Enable click links in diagrams (safe for local vault content)
  theme: 'base',
  themeVariables: {
    background: '#1e1e2e',
    mainBkg: '#313244',
    secondBkg: '#181825',
    primaryColor: '#313244',
    primaryTextColor: '#cdd6f4',
    primaryBorderColor: '#89b4fa',
    secondaryColor: '#181825',
    secondaryTextColor: '#cdd6f4',
    secondaryBorderColor: '#74c7ec',
    tertiaryColor: '#45475a',
    tertiaryTextColor: '#cdd6f4',
    tertiaryBorderColor: '#585b70',
    lineColor: '#a6adc8',
    textColor: '#cdd6f4',
    titleColor: '#cdd6f4',
    nodeBorder: '#89b4fa',
    clusterBkg: '#181825',
    clusterBorder: '#45475a',
    edgeLabelBackground: '#1e1e2e',
    classText: '#cdd6f4',
    actorBkg: '#313244',
    actorBorder: '#89b4fa',
    actorTextColor: '#cdd6f4',
    actorLineColor: '#a6adc8',
    signalColor: '#a6adc8',
    signalTextColor: '#cdd6f4',
    labelBoxBkgColor: '#313244',
    labelBoxBorderColor: '#89b4fa',
    labelTextColor: '#cdd6f4',
    loopTextColor: '#cdd6f4',
    noteBkgColor: '#313244',
    noteBorderColor: '#f9e2af',
    noteTextColor: '#cdd6f4',
    activationBkgColor: '#45475a',
    activationBorderColor: '#89b4fa',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
  },
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

/** When picking the nearest heading above the viewport, allow this many px of slack below scrollTop */
const NEAREST_HEADING_TOLERANCE_PX = 100

function findNearestHeadingId(): string | null {
  const scrollContainer = document.querySelector('.content-scroll')
  if (!scrollContainer) return null

  const headings = scrollContainer.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
  const scrollTop = scrollContainer.scrollTop
  const containerTop = scrollContainer.getBoundingClientRect().top
  let nearestId: string | null = null
  let nearestDistance = Infinity

  for (const heading of headings) {
    const relativeTop = heading.getBoundingClientRect().top - containerTop + scrollTop
    if (relativeTop > scrollTop + NEAREST_HEADING_TOLERANCE_PX) continue
    const distance = Math.abs(relativeTop - scrollTop)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestId = heading.getAttribute('id')
    }
  }
  return nearestId
}

function hashSimple(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

function normalizePath(path: string): string {
  const isAbsolute = path.startsWith('/')
  const parts = path.split('/').filter((p) => p && p !== '.')
  const stack: string[] = []
  for (const part of parts) {
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return (isAbsolute ? '/' : '') + stack.join('/')
}

export const MarkdownView = React.memo(function MarkdownView() {
  const {
    selection,
    selectFile,
    viewMode,
    presentationIndex,
    setPresentationTotal
  } = useEditorStore()
  const selectedFile = selectedFilePath(selection)
  const presentationMode = viewMode === ViewMode.Presentation
  const { vaultPath, fileTree } = useVaultStore()

  const fileDir = selectedFile ? selectedFile.replace(/\/[^/]+$/, '') : undefined

  const [sections, setSections] = useState<MarkdownSection[]>([])
  const [rawContent, setRawContent] = useState('')
  const [frontmatter, setFrontmatter] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [conflict, setConflict] = useState<{ sectionId: string; newMarkdown: string } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close (and clear highlights) when switching files
  useEffect(() => {
    setFindOpen(false)
  }, [selectedFile])

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
    loadFile(selectedFile)
      .then(() => { if (cancelled) return })
      .catch(() => {})
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
      if (useGraphStore.getState().semanticEnabled) {
        window.axonize.semantic.incremental(vaultPath).catch(() => {})
      }
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

      let diskContent: string
      try {
        diskContent = await window.axonize.file.read(selectedFile)
      } catch {
        return
      }
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
      if (!anchor) {
        // Vault files cited as inline code navigate too (common in agent answers)
        handleCodeFileReferenceClick(e, vaultPath, selectFile)
        return
      }

      // SVG anchors use xlink:href, HTML anchors use href
      const href = anchor.getAttribute('href') ?? anchor.getAttribute('xlink:href')
      if (!href) return

      if (href.startsWith('http://') || href.startsWith('https://'))
        return

      e.preventDefault()

      // Persist the visible section to history before navigating so back returns there
      const headingId = findNearestHeadingId()
      if (headingId) useEditorStore.getState().updateCurrentHash(headingId)

      if (isDocLink(href)) {
        if (vaultPath) {
          void resolveDocLink(href, vaultPath).then((path) => {
            if (path) selectFile(path)
          })
        }
        return
      }

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

      selectFile(`${normalizePath(fullPath)}${hash}`)
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
              <SectionBlock key={s.id} section={s} onSave={handleSave} onLinkClick={handleLinkClick} fileDir={fileDir} />
            ))}
          </div>
        )}
        <div className="presentation-current">
          {currentSlide.map((s) => (
            <SectionBlock key={s.id} section={s} onSave={handleSave} onLinkClick={handleLinkClick} fileDir={fileDir} />
          ))}
        </div>
        {nextSlide && (
          <div className="presentation-adjacent presentation-adjacent--next" style={{ opacity: ADJACENT_OPACITY }}>
            {nextSlide.map((s) => (
              <SectionBlock key={s.id} section={s} onSave={handleSave} onLinkClick={handleLinkClick} fileDir={fileDir} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="markdown-view" data-testid={TEST_IDS.MARKDOWN_VIEW} ref={contentRef}>
      {findOpen && (
        <FindInFileBar
          container={contentRef.current}
          contentVersion={rawContent}
          onClose={() => setFindOpen(false)}
        />
      )}
      {frontmatter && <FrontmatterTable raw={frontmatter} />}
      {sections.length === 0 && (
        <SectionInsert afterLine={0} onInsert={handleInsert} />
      )}
      {sections.map((section, _) => (
        <React.Fragment key={section.id}>
          <SectionBlock
            section={section}
            onSave={handleSave}
            onLinkClick={handleLinkClick}
            fileDir={fileDir}
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
