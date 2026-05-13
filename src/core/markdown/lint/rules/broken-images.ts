import type { Image } from 'mdast'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { relativePathFromVault, resolveRelative, walkNodes } from '../utils'

export function checkBrokenImages(ctx: LintContext): LintIssue[] {
  const { filePath, vaultPath, vaultFiles, tree } = ctx
  const issues: LintIssue[] = []
  const currentRelPath = relativePathFromVault(filePath, vaultPath)

  walkNodes<Image>(tree, 'image', (node) => {
    const url = node.url
    if (!url || url.startsWith('http') || url.startsWith('data:')) return

    const decoded = decodeURIComponent(url)
    const resolved = decoded.startsWith('/') ? decoded.slice(1) : resolveRelative(currentRelPath, decoded)

    if (!vaultFiles.has(resolved)) {
      issues.push({
        ruleId: 'broken-image',
        severity: LintSeverity.error,
        message: `Image not found: ${url}`,
        line: node.position?.start.line ?? 0
      })
    }
  })

  return issues
}

export const rule: LintRule = {
  id: 'broken-image',
  label: 'Broken images',
  check: checkBrokenImages
}
