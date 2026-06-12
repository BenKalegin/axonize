import type { Paragraph, Strong } from 'mdast'
import { getTextContent } from '../../parser'
import { walkNodes } from '../utils'
import { LintSeverity } from '../types'
import type { VaultLintContext, VaultLintIssue, VaultLintRule } from './types'

const RULE_ID = 'glossary-collision'

// Separators accepted between a bold term and its definition: "**Term** — ...".
const DEFINITION_SEPARATOR_RE = /^\s*[—–:-]\s*/
// Definitions shorter than this are headings-in-disguise, not glossary entries.
const MIN_DEFINITION_WORDS = 3
// A genuine glossary term is defined in at most a few places. A bold "term"
// that recurs beyond this is a structural field label repeated by a template
// ("**Paper**: …", "**Problem**: …" per entry) — never a glossary collision.
const MAX_DEFINITION_SITES = 3
// Template detection: when this many distinct terms each repeat within one
// document, they repeat in lockstep ("**Problem**/**Solution**" per entry) —
// all of that document's repeating terms are field labels, not glossary terms.
const MIN_LOCKSTEP_TERMS = 2

interface Definition {
  term: string
  normalizedText: string
  relativePath: string
  line: number
}

function definitionOf(p: Paragraph, relativePath: string): Definition | null {
  const [first, ...rest] = p.children
  if (!first || first.type !== 'strong') return null
  const remainder = rest.map((n) => getTextContent(n)).join('')
  const separated = DEFINITION_SEPARATOR_RE.exec(remainder)
  if (!separated) return null
  const text = remainder.slice(separated[0].length)
  if (normalize(text).split(' ').length < MIN_DEFINITION_WORDS) return null
  return {
    term: normalize(getTextContent(first as Strong)),
    normalizedText: normalize(text),
    relativePath,
    line: p.position?.start.line ?? 0
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectDefinitions(ctx: VaultLintContext): Map<string, Definition[]> {
  const byTerm = new Map<string, Definition[]>()
  for (const doc of ctx.documents.values()) {
    const docDefs: Definition[] = []
    walkNodes<Paragraph>(doc.tree, 'paragraph', (p) => {
      const def = definitionOf(p, doc.relativePath)
      if (def && def.term) docDefs.push(def)
    })
    for (const def of withoutTemplateLabels(docDefs)) {
      const defs = byTerm.get(def.term) ?? []
      defs.push(def)
      byTerm.set(def.term, defs)
    }
  }
  return byTerm
}

/**
 * Drop a document's lockstep-repeating terms: if several distinct terms each
 * have multiple definition sites in the same document, the document uses a
 * per-entry template and those terms are field labels. A single repeating
 * term (with no companions) is kept — that is a genuine in-doc collision.
 */
function withoutTemplateLabels(docDefs: Definition[]): Definition[] {
  const siteCount = new Map<string, number>()
  for (const def of docDefs) {
    siteCount.set(def.term, (siteCount.get(def.term) ?? 0) + 1)
  }
  const repeating = [...siteCount.entries()].filter(([, n]) => n > 1).map(([term]) => term)
  if (repeating.length < MIN_LOCKSTEP_TERMS) return docDefs
  const labels = new Set(repeating)
  return docDefs.filter((def) => !labels.has(def.term))
}

export function checkGlossaryCollisions(ctx: VaultLintContext): VaultLintIssue[] {
  const issues: VaultLintIssue[] = []
  for (const [term, defs] of collectDefinitions(ctx)) {
    if (defs.length > MAX_DEFINITION_SITES) continue
    const canonical = defs[0]
    for (const def of defs.slice(1)) {
      if (def.normalizedText === canonical.normalizedText) continue
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.warning,
        message: `"${term}" is defined differently at ${canonical.relativePath}:${canonical.line}`,
        line: def.line,
        relativePath: def.relativePath
      })
    }
  }
  return issues
}

export const rule: VaultLintRule = {
  id: RULE_ID,
  label: 'Glossary collisions',
  check: checkGlossaryCollisions
}
