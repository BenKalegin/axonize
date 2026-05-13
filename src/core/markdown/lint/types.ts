import type { Root } from 'mdast'

export const LintSeverity = {
  error: 'error',
  warning: 'warning',
  info: 'info'
} as const
export type LintSeverity = (typeof LintSeverity)[keyof typeof LintSeverity]

export interface LintIssue {
  ruleId: string
  severity: LintSeverity
  message: string
  line: number
  column?: number
}

export interface LintContext {
  filePath: string
  vaultPath: string
  content: string
  tree: Root
  // All vault file relative paths with original extensions (e.g. "notes/foo.md", "images/photo.png")
  vaultFiles: Set<string>
  getFileContent: (relativePath: string) => string | undefined
}

export interface LintRule {
  id: string
  label: string
  check: (ctx: LintContext) => LintIssue[]
  fix?: (content: string, issue: LintIssue) => string | null
}
