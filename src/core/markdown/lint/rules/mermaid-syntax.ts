import type { Code } from 'mdast'
import { stripMermaidFrontmatter } from '../../mermaid-frontmatter'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'
import { lineOf, patchLine } from '../utils'

interface SyntaxCheck {
  pattern: RegExp
  message: (match: RegExpExecArray) => string
}

// Known LLM-generated mermaid syntax errors
const SYNTAX_CHECKS: SyntaxCheck[] = [
  {
    // <br>, <br/>, <br /> inside node labels break mermaid parser
    pattern: /<br\s*\/?>/gi,
    message: () => 'HTML <br> tag inside mermaid node label causes parse error — use \\n instead'
  },
  {
    // Unquoted node labels containing parentheses after a word (LLM often forgets quotes)
    // e.g.  graph["something(no label)"] — this is valid; but graph[something(no label)] is not
    // Detecting: bare word immediately followed by ( inside a bracket node without quotes
    pattern: /^\s*\w[\w\s]*\[(?!["'(])([^\]]*\([^)]*\))/gm,
    message: (m) =>
      `Mermaid node label with parentheses may need quoting: ${m[0].trim().slice(0, 60)}`
  }
]

export function checkMermaidSyntax(ctx: LintContext): LintIssue[] {
  const issues: LintIssue[] = []

  for (const node of ctx.tree.children) {
    if (node.type !== 'code') continue
    const block = node as Code
    if (block.lang?.toLowerCase() !== 'mermaid') continue

    const blockStartLine = block.position?.start.line ?? 0
    const diagramSource = stripMermaidFrontmatter(block.value)

    for (const check of SYNTAX_CHECKS) {
      let match: RegExpExecArray | null
      const reportedLines = new Set<number>()
      check.pattern.lastIndex = 0
      while ((match = check.pattern.exec(diagramSource)) !== null) {
        const relLine = lineOf(diagramSource, match.index)
        const absLine = blockStartLine + relLine
        if (reportedLines.has(absLine)) continue
        reportedLines.add(absLine)
        issues.push({
          ruleId: 'mermaid-syntax',
          severity: LintSeverity.warning,
          message: check.message(match),
          line: absLine
        })
      }
    }
  }

  return issues
}

export const rule: LintRule = {
  id: 'mermaid-syntax',
  label: 'Mermaid syntax',
  check: checkMermaidSyntax,
  fix: (content, issue) =>
    patchLine(content, issue.line, (line) => line.replace(/<br\s*\/?>/gi, '\\n'))
}
