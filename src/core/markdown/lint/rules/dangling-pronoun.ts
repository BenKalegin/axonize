import type { Paragraph } from 'mdast'
import { getTextContent } from '../../parser'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'

const RULE_ID = 'dangling-pronoun'

// Demonstratives / subject pronouns whose antecedent, at a section start,
// lives in the prior section — exactly what RAG chunking severs.
const OPENER_PRONOUNS = new Set(['this', 'these', 'those', 'that', 'they'])

// Adverbs that may sit between the pronoun and its verb ("This also means").
const INTERVENING_ADVERBS = new Set([
  'also', 'often', 'then', 'thus', 'therefore', 'however', 'instead',
  'typically', 'generally', 'usually', 'simply', 'just', 'now', 'here',
  'still', 'again', 'further', 'always', 'sometimes', 'already', 'thereby'
])

// Verbs/auxiliaries marking the pronoun as *pronominal* — no local noun anchors
// it. A following noun ("This section", "These steps") is a determiner and fine.
const PRONOMINAL_VERBS = new Set([
  'is', 'are', 'was', 'were', 'be', 'being', 'been',
  'will', 'would', 'can', 'could', 'should', 'shall', 'must', 'may', 'might',
  'do', 'does', 'did', 'has', 'have', 'had',
  'means', 'mean', 'allows', 'allow', 'enables', 'enable', 'provides', 'provide',
  'requires', 'require', 'makes', 'make', 'lets', 'let', 'gives', 'give',
  'ensures', 'ensure', 'causes', 'cause', 'results', 'result', 'refers', 'refer',
  'includes', 'include', 'contains', 'contain', 'works', 'work', 'happens', 'happen',
  'occurs', 'occur', 'applies', 'apply', 'helps', 'help', 'shows', 'show',
  'defines', 'define', 'describes', 'describe', 'explains', 'explain',
  'represents', 'represent', 'indicates', 'indicate', 'comes', 'come',
  'consists', 'consist', 'depends', 'depend', 'relies', 'rely', 'leads', 'lead'
])

/** First block after each heading, when that block is a paragraph. */
function sectionOpeners(ctx: LintContext): Paragraph[] {
  const openers: Paragraph[] = []
  let expecting = false
  for (const node of ctx.tree.children) {
    if (node.type === 'heading') {
      expecting = true
      continue
    }
    if (!expecting) continue
    expecting = false
    if (node.type === 'paragraph') openers.push(node as Paragraph)
  }
  return openers
}

function opensWithDanglingPronoun(text: string): boolean {
  const words = text.match(/[A-Za-z']+/g)
  if (!words || words.length < 2) return false
  if (!OPENER_PRONOUNS.has(words[0].toLowerCase())) return false
  let i = 1
  if (INTERVENING_ADVERBS.has(words[i].toLowerCase())) i++
  const verb = words[i]?.toLowerCase()
  return verb !== undefined && PRONOMINAL_VERBS.has(verb)
}

export function checkDanglingPronouns(ctx: LintContext): LintIssue[] {
  const issues: LintIssue[] = []
  for (const para of sectionOpeners(ctx)) {
    const text = getTextContent(para).trim()
    if (!opensWithDanglingPronoun(text)) continue
    const opener = text.split(/\s+/).slice(0, 2).join(' ')
    issues.push({
      ruleId: RULE_ID,
      severity: LintSeverity.info,
      message: `Section opens with a dangling reference ("${opener}…"); the antecedent is in a prior section and is lost when this section is retrieved alone`,
      line: para.position?.start.line ?? 0
    })
  }
  return issues
}

export const rule: LintRule = {
  id: RULE_ID,
  label: 'Dangling section-opening pronouns',
  check: checkDanglingPronouns
}
