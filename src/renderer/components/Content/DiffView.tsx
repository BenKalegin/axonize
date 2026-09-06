import { useEffect, useState } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useEditorStore } from '@/store/editor-store'
import { useGitStore } from '@/store/git-store'
import { renderMarkdown } from '@/lib/markdown-renderer'

const MAX_DIFF_GROUPS = 500

type DiffLineType = 'file-header' | 'hunk-header' | 'added' | 'removed' | 'context'

interface DiffGroup {
  type: DiffLineType
  lines: string[]
}

interface RenderedGroup {
  type: DiffLineType
  html: string
}

function parseDiff(diff: string): DiffGroup[] {
  const groups: DiffGroup[] = []
  let inContent = false

  for (const line of diff.split('\n')) {
    if (!line) continue
    if (line.startsWith('\\')) continue

    let type: DiffLineType
    let content: string

    if (!inContent && (
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ')
    )) {
      type = 'file-header'
      content = line
    } else if (line.startsWith('@@')) {
      type = 'hunk-header'
      content = line
      inContent = true
    } else if (line.startsWith('+')) {
      type = 'added'
      content = line.slice(1)
    } else if (line.startsWith('-')) {
      type = 'removed'
      content = line.slice(1)
    } else {
      type = 'context'
      content = line.startsWith(' ') ? line.slice(1) : line
    }

    const last = groups[groups.length - 1]
    if (last && last.type === type) {
      last.lines.push(content)
    } else {
      groups.push({ type, lines: [content] })
    }
  }

  return groups
}

async function renderGroups(groups: DiffGroup[]): Promise<RenderedGroup[]> {
  const capped = groups.slice(0, MAX_DIFF_GROUPS)
  return Promise.all(
    capped.map(async (g) => {
      if (g.type === 'hunk-header' || g.type === 'file-header') {
        return { type: g.type, html: g.lines.join('\n') }
      }
      const html = await renderMarkdown(g.lines.join('\n'))
      return { type: g.type, html }
    })
  )
}

export function DiffView() {
  const diffPreviewFile = useEditorStore((s) => s.diffPreviewFile)
  const gitRoot = useGitStore((s) => s.gitRoot)
  const [groups, setGroups] = useState<RenderedGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!diffPreviewFile || !gitRoot) return
    let cancelled = false
    setGroups([])
    setLoading(true)
    setError(null)
    window.axonize.git
      .diffFile(gitRoot, diffPreviewFile.path, diffPreviewFile.staged)
      .then(async (diff) => {
        if (cancelled) return
        const parsed = parseDiff(diff)
        const rendered = await renderGroups(parsed)
        if (!cancelled) {
          setGroups(rendered)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [diffPreviewFile, gitRoot])

  if (loading) {
    return <div className="diff-view diff-loading" data-testid={TEST_IDS.DIFF_VIEW}>Loading diff…</div>
  }
  if (error) {
    return <div className="diff-view diff-error" data-testid={TEST_IDS.DIFF_VIEW}>{error}</div>
  }
  if (groups.length === 0) {
    return <div className="diff-view diff-empty" data-testid={TEST_IDS.DIFF_VIEW}>No changes</div>
  }

  return (
    <div className="diff-view" data-testid={TEST_IDS.DIFF_VIEW}>
      {groups.map((g, i) => (
        <div
          key={i}
          className={`diff-group diff-group--${g.type}`}
          dangerouslySetInnerHTML={{ __html: g.html }}
        />
      ))}
    </div>
  )
}
