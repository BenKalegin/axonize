import type { Paragraph } from 'mdast'
import { getTextContent } from '../../parser'
import { walkNodes } from '../utils'
import { LintSeverity, type LintContext, type LintIssue, type LintRule } from '../types'

const RULE_ID = 'lexical-repetition'
// Paragraphs shorter than this are too generic to flag as duplicated.
const MIN_PARAGRAPH_WORDS = 12
// Repeated sentences shorter than this are likely idioms, not drift.
const MIN_SENTENCE_WORDS = 8
// Word n-gram size for paragraph shingling.
const SHINGLE_SIZE = 3
// Jaccard similarity at or above which two paragraphs count as near-duplicates.
const NEAR_DUPLICATE_JACCARD = 0.6
// Quadratic-comparison guard for pathological documents.
const MAX_COMPARED_PARAGRAPHS = 500

const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+/

interface ParagraphInfo {
  index: number
  line: number
  text: string
  wordCount: number
  shingles: Set<string>
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function shinglesOf(words: string[]): Set<string> {
  const shingles = new Set<string>()
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) {
    shingles.add(words.slice(i, i + SHINGLE_SIZE).join(' '))
  }
  return shingles
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const s of a) if (b.has(s)) intersection++
  return intersection / (a.size + b.size - intersection)
}

function collectParagraphs(ctx: LintContext): ParagraphInfo[] {
  const paragraphs: ParagraphInfo[] = []
  walkNodes<Paragraph>(ctx.tree, 'paragraph', (p) => {
    const text = getTextContent(p)
    const words = normalizeWords(text)
    paragraphs.push({
      index: paragraphs.length,
      line: p.position?.start.line ?? 0,
      text,
      wordCount: words.length,
      shingles: shinglesOf(words)
    })
  })
  return paragraphs
}

function findNearDuplicateParagraphs(
  paragraphs: ParagraphInfo[],
  flaggedPairs: Set<string>
): LintIssue[] {
  const issues: LintIssue[] = []
  const compared = paragraphs
    .filter((p) => p.wordCount >= MIN_PARAGRAPH_WORDS)
    .slice(0, MAX_COMPARED_PARAGRAPHS)
  for (let i = 0; i < compared.length; i++) {
    for (let j = i + 1; j < compared.length; j++) {
      const similarity = jaccard(compared[i].shingles, compared[j].shingles)
      if (similarity < NEAR_DUPLICATE_JACCARD) continue
      flaggedPairs.add(pairKey(compared[i], compared[j]))
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.info,
        message: `Paragraph is ${Math.round(similarity * 100)}% similar to the one at line ${compared[i].line}`,
        line: compared[j].line
      })
    }
  }
  return issues
}

function findDuplicateSentences(
  paragraphs: ParagraphInfo[],
  flaggedPairs: Set<string>
): LintIssue[] {
  const issues: LintIssue[] = []
  const seen = new Map<string, ParagraphInfo>()
  for (const p of paragraphs) {
    for (const sentence of normalizedSentencesOf(p)) {
      const first = seen.get(sentence)
      if (!first) {
        seen.set(sentence, p)
        continue
      }
      if (first.index === p.index || flaggedPairs.has(pairKey(first, p))) continue
      flaggedPairs.add(pairKey(first, p))
      issues.push({
        ruleId: RULE_ID,
        severity: LintSeverity.info,
        message: `Sentence repeats one at line ${first.line}`,
        line: p.line
      })
    }
  }
  return issues
}

function normalizedSentencesOf(p: ParagraphInfo): string[] {
  return p.text
    .split(SENTENCE_BOUNDARY_RE)
    .map((s) => normalizeWords(s))
    .filter((words) => words.length >= MIN_SENTENCE_WORDS)
    .map((words) => words.join(' '))
}

function pairKey(a: ParagraphInfo, b: ParagraphInfo): string {
  return `${a.index}:${b.index}`
}

export function checkLexicalRepetition(ctx: LintContext): LintIssue[] {
  const paragraphs = collectParagraphs(ctx)
  const flaggedPairs = new Set<string>()
  const paragraphIssues = findNearDuplicateParagraphs(paragraphs, flaggedPairs)
  const sentenceIssues = findDuplicateSentences(paragraphs, flaggedPairs)
  return [...paragraphIssues, ...sentenceIssues]
}

export const rule: LintRule = {
  id: RULE_ID,
  label: 'Repeated content',
  check: checkLexicalRepetition
}
