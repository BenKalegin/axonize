import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { patchLine, walkNodes } from '../utils'

const FLAGGED_TAGS_RE = /<(div|span|br|p|b|i|u)\b[^>]*\/?>/gi

interface HtmlNode {
  value: string
  position?: { start: { line: number } }
}

export function checkTrailingHtml(ctx: LintContext): LintIssue[] {
  const issues: LintIssue[] = []

  walkNodes<HtmlNode>(ctx.tree, 'html', (node) => {
    FLAGGED_TAGS_RE.lastIndex = 0
    if (FLAGGED_TAGS_RE.test(node.value)) {
      issues.push({
        ruleId: 'trailing-html',
        severity: LintSeverity.warning,
        message: `Raw HTML tag in markdown: ${node.value.slice(0, 60).trim()}`,
        line: node.position?.start.line ?? 0
      })
    }
  })

  return issues
}

export const rule: LintRule = {
  id: 'trailing-html',
  label: 'Raw HTML tags',
  check: checkTrailingHtml,
  fix: (content, issue) =>
    patchLine(content, issue.line, (line) =>
      line
        .replace(/<b>(.*?)<\/b>/gi, '**$1**')
        .replace(/<i>(.*?)<\/i>/gi, '_$1_')
        .replace(/<u>(.*?)<\/u>/gi, '$1')
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<p>(.*?)<\/p>/gi, '$1')
        .replace(/<(?:div|span)>(.*?)<\/(?:div|span)>/gi, '$1')
    )
}
