import { useCallback, useEffect, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore } from '@/store/editor-store'
import { splitSections, type MarkdownSection } from '@/lib/section-splitter'

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/
const INDENT_PER_LEVEL = 12

interface HeadingEntry {
  title: string
  depth: number
  slug: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractHeadings(sections: MarkdownSection[]): HeadingEntry[] {
  return sections
    .filter((s) => s.kind === 'heading' && s.title)
    .map((s) => ({
      title: s.title,
      depth: s.depth,
      slug: slugify(s.title)
    }))
}

function HeadingRow({
  entry,
  isActive,
  onClick
}: {
  entry: HeadingEntry
  isActive: boolean
  onClick: () => void
}) {
  const paddingLeft = INDENT_PER_LEVEL * (entry.depth - 1) + 8

  return (
    <button
      className={`outline-heading${isActive ? ' active' : ''}`}
      data-testid={TEST_IDS.OUTLINE_HEADING}
      style={{ paddingLeft }}
      onClick={onClick}
      title={entry.title}
    >
      <span className="outline-heading-icon">H{entry.depth}</span>
      <span className="outline-heading-text">{entry.title}</span>
    </button>
  )
}

export function OutlinePanel() {
  const { selectedFile, selectFile } = useEditorStore()
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  const filePath = selectedFile?.split('#')[0] ?? null

  useEffect(() => {
    if (!filePath) {
      setHeadings([])
      return
    }

    let cancelled = false
    window.axonize.file.read(filePath).then((content) => {
      if (cancelled) return
      const stripped = content.replace(FRONTMATTER_RE, '')
      const sections = splitSections(stripped)
      setHeadings(extractHeadings(sections))
    }).catch(() => {
      if (!cancelled) setHeadings([])
    })
    return () => { cancelled = true }
  }, [filePath])

  useEffect(() => {
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '0px 0px -80% 0px', threshold: 0 }
    )

    for (const h of headings) {
      const el = document.getElementById(h.slug)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  const handleClick = useCallback(
    (slug: string) => {
      if (!selectedFile) return
      selectFile(`${selectedFile}#${slug}`)
      setActiveSlug(slug)
    },
    [selectedFile, selectFile]
  )

  return (
    <div className="outline-panel" data-testid={TEST_IDS.OUTLINE_PANEL}>
      <div className="sidebar-header">
        <span>Outline</span>
      </div>
      <div className="outline-list">
        {!selectedFile ? (
          <div className="outline-empty">No file open</div>
        ) : headings.length === 0 ? (
          <div className="outline-empty">No headings</div>
        ) : (
          headings.map((entry, i) => (
            <HeadingRow
              key={`${entry.slug}-${i}`}
              entry={entry}
              isActive={activeSlug === entry.slug}
              onClick={() => handleClick(entry.slug)}
            />
          ))
        )}
      </div>
    </div>
  )
}
