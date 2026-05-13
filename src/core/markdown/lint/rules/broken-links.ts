import type { Link } from 'mdast'
import { WIKILINK_RE } from '../../link-patterns'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { lineOf, relativePathFromVault, resolveRelative, walkNodes } from '../utils'

function normalizeMdPath(path: string): string {
  return path.replace(/\.md$/, '')
}

function fileExists(vaultFiles: Set<string>, normalizedPath: string): boolean {
  return vaultFiles.has(normalizedPath + '.md') || vaultFiles.has(normalizedPath)
}

function buildBasenameIndex(vaultFiles: Set<string>): Set<string> {
  const basenames = new Set<string>()
  for (const f of vaultFiles) {
    const basename = f.replace(/\.md$/, '').split('/').pop()
    if (basename) basenames.add(basename)
  }
  return basenames
}

function wikilinkExists(vaultFiles: Set<string>, basenames: Set<string>, target: string): boolean {
  if (fileExists(vaultFiles, target)) return true
  const basename = target.split('/').pop() ?? target
  return basenames.has(basename)
}

export function checkBrokenLinks(ctx: LintContext): LintIssue[] {
  const { filePath, vaultPath, content, vaultFiles, tree } = ctx
  const issues: LintIssue[] = []
  const currentRelPath = relativePathFromVault(filePath, vaultPath)
  const basenames = buildBasenameIndex(vaultFiles)

  walkNodes<Link>(tree, 'link', (node) => {
    const url = node.url
    if (!url || url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('#')) return

    const [rawPath] = url.split('#')
    if (!rawPath) return

    const decoded = decodeURIComponent(rawPath)
    const resolved = decoded.startsWith('/')
      ? normalizeMdPath(decoded.slice(1))
      : normalizeMdPath(resolveRelative(currentRelPath, decoded))

    if (!fileExists(vaultFiles, resolved)) {
      issues.push({
        ruleId: 'broken-link',
        severity: LintSeverity.error,
        message: `Link target not found: ${rawPath}`,
        line: node.position?.start.line ?? 0
      })
    }
  })

  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const raw = match[1]
    const [target] = raw.split('#')
    if (!target) continue

    if (!wikilinkExists(vaultFiles, basenames, target)) {
      issues.push({
        ruleId: 'broken-link',
        severity: LintSeverity.error,
        message: `Wikilink target not found: [[${target}]]`,
        line: lineOf(content, match.index)
      })
    }
  }

  return issues
}

export const rule: LintRule = {
  id: 'broken-link',
  label: 'Broken links',
  check: checkBrokenLinks
}
