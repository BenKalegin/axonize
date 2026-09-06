import type { LintIssue } from '@core/markdown/lint/types'
import { RULES } from '@core/markdown/lint/linter'

export type Fixer = (content: string, issue: LintIssue) => string | null

const CONTEXT_LINES = 15

const FIXER_MAP = new Map(
  RULES.flatMap((r) => (r.fix ? [[r.id, r.fix] as const] : []))
)

export function getDeterministicFixer(ruleId: string): Fixer | null {
  return FIXER_MAP.get(ruleId) ?? null
}

export function applyFixAll(content: string, issues: LintIssue[], ruleId: string): string | null {
  const fixer = getDeterministicFixer(ruleId)
  if (!fixer) return null
  const sorted = [...issues].sort((a, b) => b.line - a.line)
  let result = content
  for (const issue of sorted) {
    result = fixer(result, issue) ?? result
  }
  return result === content ? null : result
}

export async function applyLlmFix(content: string, issue: LintIssue): Promise<string> {
  const lines = content.split('\n')
  const start = Math.max(0, issue.line - CONTEXT_LINES - 1)
  const end = Math.min(lines.length, issue.line + CONTEXT_LINES)
  const section = lines.slice(start, end).join('\n')

  const instruction = `Fix this markdown lint issue and return only the corrected text with no explanation: ${issue.message}`
  const fixed = await window.axonize.llm.rewriteSection(section, instruction)

  const result = [...lines]
  result.splice(start, end - start, ...fixed.split('\n'))
  return result.join('\n')
}

export async function applyLlmFixAll(content: string, issues: LintIssue[]): Promise<string> {
  const list = issues.map((i, n) => `${n + 1}. Line ${i.line}: ${i.message}`).join('\n')
  const instruction = `Fix all of the following markdown lint issues and return only the corrected document with no explanation:\n${list}`
  return window.axonize.llm.rewriteSection(content, instruction)
}

export async function readFixWrite(
  filePath: string,
  fixFn: (content: string) => string | null | Promise<string | null>,
  onFixed: () => void
): Promise<void> {
  const content = await window.axonize.file.read(filePath)
  const fixed = await fixFn(content)
  if (fixed !== null) {
    await window.axonize.file.write(filePath, fixed)
    onFixed()
  }
}
