import type { Heading } from 'mdast'
import { getTextContent } from '../../parser'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'

const RULE_ID = 'heading-structure'
const MANUAL_NUMBER_RE = /^(\d+)[.):]\s+/

interface HeadingInfo {
  depth: number
  text: string
  line: number
}

function collectHeadings(ctx: LintContext): HeadingInfo[] {
  const headings: HeadingInfo[] = []
  for (const node of ctx.tree.children) {
    if (node.type !== 'heading') continue
    const heading = node as Heading
    headings.push({
      depth: heading.depth,
      text: getTextContent(heading),
      line: heading.position?.start.line ?? 0
    })
  }
  return headings
}

function checkSkippedLevels(headings: HeadingInfo[]): LintIssue[] {
  const issues: LintIssue[] = []
  let prevDepth: number | null = null
  for (const h of headings) {
    if (prevDepth !== null && h.depth > prevDepth + 1) {
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.warning,
        message: `Heading level skips from h${prevDepth} to h${h.depth}`,
        line: h.line
      })
    }
    prevDepth = h.depth
  }
  return issues
}

/**
 * Manually numbered headings ("1. Intro", "2) Setup") at the same depth must
 * increment by one within a run; a run resets when a shallower heading starts
 * a new section.
 */
function checkManualNumbering(headings: HeadingInfo[]): LintIssue[] {
  const issues: LintIssue[] = []
  const runByDepth = new Map<number, number>()
  for (const h of headings) {
    for (const depth of runByDepth.keys()) {
      if (depth > h.depth) runByDepth.delete(depth)
    }
    const match = MANUAL_NUMBER_RE.exec(h.text)
    if (!match) {
      runByDepth.delete(h.depth)
      continue
    }
    const num = parseInt(match[1], 10)
    const prev = runByDepth.get(h.depth)
    if (prev !== undefined && num !== prev + 1) {
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.info,
        message: `Manual heading numbering jumps from ${prev} to ${num}`,
        line: h.line
      })
    }
    runByDepth.set(h.depth, num)
  }
  return issues
}

export function checkHeadingStructure(ctx: LintContext): LintIssue[] {
  const headings = collectHeadings(ctx)
  return [...checkSkippedLevels(headings), ...checkManualNumbering(headings)]
}

export const rule: LintRule = {
  id: RULE_ID,
  label: 'Heading structure',
  check: checkHeadingStructure
}
