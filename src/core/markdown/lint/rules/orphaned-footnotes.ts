import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { lineOf } from '../utils'

const DEF_RE = /^\[\^([^\]]+)\]:/gm
const REF_RE = /\[\^([^\]]+)\](?!:)/g

export function checkOrphanedFootnotes(ctx: LintContext): LintIssue[] {
  const { content } = ctx
  const defs = new Map<string, number>()
  const refs = new Map<string, number>()

  let match: RegExpExecArray | null
  DEF_RE.lastIndex = 0
  while ((match = DEF_RE.exec(content)) !== null) {
    defs.set(match[1], lineOf(content, match.index))
  }

  REF_RE.lastIndex = 0
  while ((match = REF_RE.exec(content)) !== null) {
    if (!refs.has(match[1])) {
      refs.set(match[1], lineOf(content, match.index))
    }
  }

  const issues: LintIssue[] = []

  for (const [id, line] of refs) {
    if (!defs.has(id)) {
      issues.push({
        ruleId: 'orphaned-footnote',
        severity: LintSeverity.warning,
        message: `Footnote reference [^${id}] has no definition`,
        line
      })
    }
  }

  for (const [id, line] of defs) {
    if (!refs.has(id)) {
      issues.push({
        ruleId: 'orphaned-footnote',
        severity: LintSeverity.warning,
        message: `Footnote definition [^${id}] is never referenced`,
        line
      })
    }
  }

  return issues
}

export const rule: LintRule = {
  id: 'orphaned-footnote',
  label: 'Orphaned footnotes',
  check: checkOrphanedFootnotes
}
