import { parseMarkdown } from '../parser'
import type { LintContext, LintIssue, LintRule } from './types'
import { rule as duplicateHeadings } from './rules/duplicate-headings'
import { rule as orphanedFootnotes } from './rules/orphaned-footnotes'
import { rule as trailingHtml } from './rules/trailing-html'
import { rule as latexTilde } from './rules/latex-tilde'
import { rule as mermaidColors } from './rules/mermaid-colors'
import { rule as mermaidSyntax } from './rules/mermaid-syntax'
import { rule as brokenImages } from './rules/broken-images'
import { rule as brokenLinks } from './rules/broken-links'
import { rule as headingStructure } from './rules/heading-structure'
import { rule as lexicalRepetition } from './rules/lexical-repetition'
import { rule as codeFenceHygiene } from './rules/code-fence-hygiene'

export const RULES: LintRule[] = [
  duplicateHeadings,
  orphanedFootnotes,
  trailingHtml,
  latexTilde,
  mermaidColors,
  mermaidSyntax,
  brokenImages,
  brokenLinks,
  headingStructure,
  lexicalRepetition,
  codeFenceHygiene
]

export function lintMarkdown(input: Omit<LintContext, 'tree'>): LintIssue[] {
  const ctx: LintContext = { ...input, tree: parseMarkdown(input.content) }
  const all = RULES.flatMap((rule) => rule.check(ctx))
  return all.sort((a, b) => a.line - b.line)
}
