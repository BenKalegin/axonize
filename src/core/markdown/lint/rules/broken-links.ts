import type { Link } from 'mdast'
import { WIKILINK_RE } from '../../link-patterns'
import { parseMarkdown } from '../../parser'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import {
  buildMdBasenameIndex,
  extractHeadingSlugs,
  fileExists,
  lineOf,
  normalizeMdPath,
  relativePathFromVault,
  resolveRelative,
  walkNodes
} from '../utils'

function resolveWikilinkPath(
  vaultFiles: Set<string>,
  basenames: Map<string, string>,
  target: string
): string | null {
  if (fileExists(vaultFiles, target)) return target
  const basename = target.split('/').pop() ?? target
  return basenames.get(basename) ?? null
}

type HasAnchor = (relativePathNoExt: string, anchor: string) => boolean | undefined

function makeAnchorResolver(ctx: LintContext, currentRelNoExt: string): HasAnchor {
  const cache = new Map<string, Set<string> | null>()
  cache.set(currentRelNoExt, extractHeadingSlugs(ctx.tree))

  return (relativePathNoExt, anchor) => {
    let slugs = cache.get(relativePathNoExt)
    if (slugs === undefined) {
      const content =
        ctx.getFileContent(relativePathNoExt + '.md') ?? ctx.getFileContent(relativePathNoExt)
      slugs = content === undefined ? null : extractHeadingSlugs(parseMarkdown(content))
      cache.set(relativePathNoExt, slugs)
    }
    return slugs === null ? undefined : slugs.has(anchor)
  }
}

function anchorIssue(message: string, line: number): LintIssue {
  return { ruleId: 'broken-link', severity: LintSeverity.error, message, line }
}

interface BrokenLinkCtx {
  currentRelPath: string
  currentRelNoExt: string
  vaultFiles: Set<string>
  basenames: Map<string, string>
  hasAnchor: HasAnchor
}

function checkMdLink(url: string, line: number, c: BrokenLinkCtx): LintIssue | null {
  if (url.startsWith('#')) {
    const anchor = decodeURIComponent(url.slice(1))
    if (anchor && c.hasAnchor(c.currentRelNoExt, anchor) === false) {
      return anchorIssue(`Anchor not found in this file: #${anchor}`, line)
    }
    return null
  }
  const [rawPath, rawAnchor] = url.split('#')
  if (!rawPath) return null
  const decodedPath = decodeURIComponent(rawPath)
  const resolved = decodedPath.startsWith('/')
    ? normalizeMdPath(decodedPath.slice(1))
    : normalizeMdPath(resolveRelative(c.currentRelPath, decodedPath))
  if (!fileExists(c.vaultFiles, resolved)) {
    return anchorIssue(`Link target not found: ${rawPath}`, line)
  }
  if (rawAnchor) {
    const anchor = decodeURIComponent(rawAnchor)
    if (c.hasAnchor(resolved, anchor) === false) {
      return anchorIssue(`Anchor not found in ${rawPath}: #${anchor}`, line)
    }
  }
  return null
}

function checkWikilink(
  target: string,
  rawAnchor: string | undefined,
  line: number,
  c: BrokenLinkCtx
): LintIssue | null {
  if (!target) {
    if (rawAnchor && c.hasAnchor(c.currentRelNoExt, rawAnchor) === false) {
      return anchorIssue(`Anchor not found in this file: #${rawAnchor}`, line)
    }
    return null
  }
  const resolved = resolveWikilinkPath(c.vaultFiles, c.basenames, target)
  if (resolved === null) {
    return anchorIssue(`Wikilink target not found: [[${target}]]`, line)
  }
  if (rawAnchor && c.hasAnchor(resolved, rawAnchor) === false) {
    return anchorIssue(`Anchor not found in [[${target}]]: #${rawAnchor}`, line)
  }
  return null
}

export function checkBrokenLinks(ctx: LintContext): LintIssue[] {
  const { filePath, vaultPath, content, vaultFiles, tree } = ctx
  const issues: LintIssue[] = []
  const currentRelPath = relativePathFromVault(filePath, vaultPath)
  const currentRelNoExt = normalizeMdPath(currentRelPath)
  const c: BrokenLinkCtx = {
    currentRelPath,
    currentRelNoExt,
    vaultFiles,
    basenames: buildMdBasenameIndex(vaultFiles),
    hasAnchor: makeAnchorResolver(ctx, currentRelNoExt)
  }

  walkNodes<Link>(tree, 'link', (node) => {
    const url = node.url
    if (!url || url.startsWith('http') || url.startsWith('mailto:')) return
    const issue = checkMdLink(url, node.position?.start.line ?? 0, c)
    if (issue) issues.push(issue)
  })

  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const [target, rawAnchor] = match[1].split('#')
    const issue = checkWikilink(target, rawAnchor, lineOf(content, match.index), c)
    if (issue) issues.push(issue)
  }

  return issues
}

export const rule: LintRule = {
  id: 'broken-link',
  label: 'Broken links',
  check: checkBrokenLinks
}
