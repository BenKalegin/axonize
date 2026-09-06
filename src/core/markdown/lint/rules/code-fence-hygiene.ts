import type { Code } from 'mdast'
// Full registry — must stay in sync with the renderer, which highlights via
// lowlight's `all` grammar set (the same complete highlight.js registry).
import hljs from 'highlight.js'
import { walkNodes } from '../utils'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'

const RULE_ID = 'code-fence-hygiene'

// Fence languages the app renders specially (not via highlight.js).
const SPECIAL_FENCE_LANGUAGES = new Set(['mermaid', 'bpmn'])

function isKnownLanguage(lang: string): boolean {
  return SPECIAL_FENCE_LANGUAGES.has(lang) || hljs.getLanguage(lang) !== undefined
}

export function checkCodeFenceHygiene(ctx: LintContext): LintIssue[] {
  const issues: LintIssue[] = []
  walkNodes<Code>(ctx.tree, 'code', (code) => {
    const line = code.position?.start.line ?? 0
    const lang = code.lang?.trim()
    if (!lang) {
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.info,
        message: 'Unlabeled code fence — add a language tag',
        line
      })
      return
    }
    if (!isKnownLanguage(lang.toLowerCase())) {
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.info,
        message: `Unknown code fence language "${lang}" — syntax highlighting will not apply`,
        line
      })
    }
  })
  return issues
}

export const rule: LintRule = {
  id: RULE_ID,
  label: 'Code fence hygiene',
  check: checkCodeFenceHygiene
}
