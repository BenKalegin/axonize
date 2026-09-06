import type { Image } from 'mdast'
import { walkNodes, resolveRelative } from '../utils'
import { LintSeverity } from '../types'
import type { VaultLintContext, VaultLintIssue, VaultLintRule } from './types'

const RULE_ID = 'orphaned-image'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'])
// Obsidian-style embeds: ![[image.png]] (optionally with |size suffix).
const WIKILINK_EMBED_RE = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext !== undefined && IMAGE_EXTENSIONS.has(ext)
}

function collectReferencedImages(ctx: VaultLintContext): Set<string> {
  const referenced = new Set<string>()
  for (const doc of ctx.documents.values()) {
    walkNodes<Image>(doc.tree, 'image', (node) => {
      if (!node.url || node.url.startsWith('http') || node.url.startsWith('data:')) return
      const resolved = resolveRelative(doc.relativePath, decodeURIComponent(node.url))
      referenced.add(resolved)
    })
    for (const match of doc.content.matchAll(WIKILINK_EMBED_RE)) {
      // Wikilink embeds resolve by basename anywhere in the vault.
      referenced.add(match[1].split('/').pop()!.toLowerCase())
    }
  }
  return referenced
}

export function checkOrphanedImages(ctx: VaultLintContext): VaultLintIssue[] {
  const referenced = collectReferencedImages(ctx)
  const issues: VaultLintIssue[] = []
  for (const file of ctx.vaultFiles) {
    if (!isImagePath(file)) continue
    const basename = file.split('/').pop()!.toLowerCase()
    if (referenced.has(file) || referenced.has(basename)) continue
    issues.push({
      ruleId: RULE_ID,
      severity: LintSeverity.info,
      message: `Image "${file}" is not referenced by any document`,
      line: 0,
      relativePath: file
    })
  }
  return issues
}

export const rule: VaultLintRule = {
  id: RULE_ID,
  label: 'Orphaned images',
  check: checkOrphanedImages
}
