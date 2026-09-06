import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { lineOf } from '../utils'

// Matches subscript-shaped ~text~ wraps only: the opening tilde must attach
// directly to a word (H~2~O, x~i~) and the content cannot contain whitespace.
// This deliberately ignores approximation tildes (~90%, ~3s) — standalone and
// extremely common in prose — which previously paired up into false spans.
// Not ~~text~~ (GFM strikethrough).
const SINGLE_TILDE_RE = /(?<=\w)(?<!~)~(?!~)([^~\s]+)~(?!~)/g

// Strips fenced code blocks and inline code to avoid false positives
function stripCode(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))
    .replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length))
}

export function checkLatexTilde(ctx: LintContext): LintIssue[] {
  const stripped = stripCode(ctx.content)
  const issues: LintIssue[] = []

  let match: RegExpExecArray | null
  SINGLE_TILDE_RE.lastIndex = 0
  while ((match = SINGLE_TILDE_RE.exec(stripped)) !== null) {
    issues.push({
      ruleId: 'latex-tilde',
      severity: LintSeverity.warning,
      message: `Ambiguous tilde: ~${match[1]}~ looks like subscript notation but won't render`,
      line: lineOf(ctx.content, match.index)
    })
  }

  return issues
}

export const rule: LintRule = {
  id: 'latex-tilde',
  label: 'Ambiguous tildes',
  check: checkLatexTilde
}
