import type { Link } from 'mdast'
import { WIKILINK_RE } from '../../link-patterns'
import {
  buildMdBasenameIndex,
  fileExists,
  normalizeMdPath,
  resolveRelative,
  resolveWikilinkPath,
  walkNodes
} from '../utils'
import { LintSeverity } from '../types'
import type { VaultLintContext, VaultLintIssue, VaultLintRule } from './types'

const RULE_ID = 'orphaned-document'

// Landing-page docs are legitimate entry points and rarely have inbound links.
const ENTRY_DOC_BASENAMES = new Set(['index', 'readme', 'home'])

function isEntryDoc(relativePath: string): boolean {
  const basename = normalizeMdPath(relativePath).split('/').pop()?.toLowerCase()
  return basename !== undefined && ENTRY_DOC_BASENAMES.has(basename)
}

function resolveMdLink(currentRelPath: string, url: string, vaultFiles: Set<string>): string | null {
  if (!url || url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('#')) return null
  const rawPath = url.split('#')[0]
  if (!rawPath) return null
  const decoded = decodeURIComponent(rawPath)
  const resolved = decoded.startsWith('/')
    ? normalizeMdPath(decoded.slice(1))
    : normalizeMdPath(resolveRelative(currentRelPath, decoded))
  return fileExists(vaultFiles, resolved) ? resolved : null
}

/** Map of doc (normalized, no-ext path) → set of docs that link to it. */
function collectIncomingLinks(ctx: VaultLintContext): Map<string, Set<string>> {
  const basenames = buildMdBasenameIndex(ctx.vaultFiles)
  const incoming = new Map<string, Set<string>>()
  const record = (target: string, source: string): void => {
    const sources = incoming.get(target) ?? new Set<string>()
    sources.add(source)
    incoming.set(target, sources)
  }
  for (const doc of ctx.documents.values()) {
    walkNodes<Link>(doc.tree, 'link', (node) => {
      const target = resolveMdLink(doc.relativePath, node.url ?? '', ctx.vaultFiles)
      if (target) record(target, doc.relativePath)
    })
    for (const match of doc.content.matchAll(WIKILINK_RE)) {
      const resolved = resolveWikilinkPath(ctx.vaultFiles, basenames, match[1].split('#')[0])
      if (resolved) record(normalizeMdPath(resolved), doc.relativePath)
    }
  }
  return incoming
}

export function checkOrphanedDocuments(ctx: VaultLintContext): VaultLintIssue[] {
  const incoming = collectIncomingLinks(ctx)
  const issues: VaultLintIssue[] = []
  for (const doc of ctx.documents.values()) {
    if (isEntryDoc(doc.relativePath)) continue
    const sources = incoming.get(normalizeMdPath(doc.relativePath))
    // A doc linking only to itself is still orphaned.
    const hasInbound = sources !== undefined && [...sources].some((s) => s !== doc.relativePath)
    if (hasInbound) continue
    issues.push({
      ruleId: RULE_ID,
      severity: LintSeverity.info,
      message: `Document "${doc.relativePath}" has no incoming links from other documents`,
      line: 0,
      relativePath: doc.relativePath
    })
  }
  return issues
}

export const rule: VaultLintRule = {
  id: RULE_ID,
  label: 'Orphaned documents',
  check: checkOrphanedDocuments
}
