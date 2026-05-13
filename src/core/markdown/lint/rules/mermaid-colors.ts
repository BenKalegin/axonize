import type { Code } from 'mdast'
import { stripMermaidFrontmatter } from '../../mermaid-frontmatter'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { lineOf, patchLine } from '../utils'

// Matches 6-digit hex fill colors (opaque) — 8-digit hex (with alpha) is allowed
const OPAQUE_FILL_RE = /\bfill:\s*#([0-9a-fA-F]{6})(?![0-9a-fA-F])/g

export function checkMermaidColors(ctx: LintContext): LintIssue[] {
  const issues: LintIssue[] = []

  for (const node of ctx.tree.children) {
    if (node.type !== 'code') continue
    const block = node as Code
    if (block.lang?.toLowerCase() !== 'mermaid') continue

    const blockStartLine = block.position?.start.line ?? 0
    const diagramSource = stripMermaidFrontmatter(block.value)

    let match: RegExpExecArray | null
    OPAQUE_FILL_RE.lastIndex = 0
    while ((match = OPAQUE_FILL_RE.exec(diagramSource)) !== null) {
      issues.push({
        ruleId: 'mermaid-opaque-fill',
        severity: LintSeverity.warning,
        message: `Opaque fill color #${match[1]} — use 8-digit hex with alpha (e.g. #${match[1]}33) or "transparent"`,
        line: blockStartLine + lineOf(diagramSource, match.index)
      })
    }
  }

  return issues
}

export const rule: LintRule = {
  id: 'mermaid-opaque-fill',
  label: 'Mermaid opaque colors',
  check: checkMermaidColors,
  fix: (content, issue) =>
    patchLine(content, issue.line, (line) =>
      line.replace(/\bfill:\s*#([0-9a-fA-F]{6})(?![0-9a-fA-F])/g, 'fill:#$133')
    )
}
