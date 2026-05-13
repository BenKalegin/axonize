import type { Heading } from 'mdast'
import GithubSlugger from 'github-slugger'
import { getTextContent } from '../../parser'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'

function headingSlug(text: string): string {
  return new GithubSlugger().slug(text)
}

export function checkDuplicateHeadings(ctx: LintContext): LintIssue[] {
  const seen = new Map<string, number>()
  const issues: LintIssue[] = []

  for (const node of ctx.tree.children) {
    if (node.type !== 'heading') continue
    const heading = node as Heading
    const text = getTextContent(heading)
    const slug = headingSlug(text)
    const line = heading.position?.start.line ?? 0

    if (seen.has(slug)) {
      issues.push({
        ruleId: 'duplicate-heading',
        severity: LintSeverity.info,
        message: `Duplicate heading anchor "#${slug}" (also at line ${seen.get(slug)})`,
        line
      })
    } else {
      seen.set(slug, line)
    }
  }

  return issues
}

export const rule: LintRule = {
  id: 'duplicate-heading',
  label: 'Duplicate headings',
  check: checkDuplicateHeadings
}
