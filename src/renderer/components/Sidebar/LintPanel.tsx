import { useState, useMemo } from 'react'
import { TEST_IDS } from '@/lib/testids'
import { useLintStore } from '@/store/lint-store'
import { useProseStore, RefactorPhase } from '@/store/prose-store'
import { useEditorStore, selectedFilePath } from '@/store/editor-store'
import { RefactorReviewDialog } from './RefactorReviewDialog'
import type { LintIssue, LintSeverity } from '@core/markdown/lint/types'
import { RULES } from '@core/markdown/lint/linter'
import {
  getDeterministicFixer,
  applyFixAll,
  applyLlmFix,
  applyLlmFixAll,
  readFixWrite
} from './lint-fixers'

const SEVERITY_LABEL: Record<LintSeverity, string> = {
  error: 'error',
  warning: 'warn',
  info: 'info'
}

const RULE_LABEL = new Map(RULES.map((r) => [r.id, r.label]))

const WrenchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 2.5a3 3 0 0 0-4.24 4.24L2 14l1.5 1.5 7.26-7.26A3 3 0 0 0 13.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)

const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M10.5 3.5l-2 2M5.5 10.5l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

function scrollToLine(line: number): void {
  const sections = document.querySelectorAll<HTMLElement>('[id^="section-"]')
  for (const el of sections) {
    const m = el.id.match(/^section-(\d+)-(\d+)$/)
    if (!m) continue
    if (line >= Number(m[1]) && line <= Number(m[2])) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
  }
}

function IssueRow({
  issue,
  filePath,
  onFixed
}: {
  issue: LintIssue
  filePath: string
  onFixed: () => void
}) {
  const [fixing, setFixing] = useState<'det' | 'llm' | null>(null)
  const hasDeterministicFix = getDeterministicFixer(issue.ruleId) !== null

  async function applyFix(kind: 'det' | 'llm') {
    setFixing(kind)
    try {
      await readFixWrite(
        filePath,
        (content) =>
          kind === 'det'
            ? (getDeterministicFixer(issue.ruleId)?.(content, issue) ?? null)
            : applyLlmFix(content, issue),
        onFixed
      )
    } finally {
      setFixing(null)
    }
  }

  return (
    <div
      className={`lint-issue-row lint-issue-row--${issue.severity}${issue.line > 0 ? ' lint-issue-row--navigable' : ''}`}
      data-testid={TEST_IDS.LINT_ISSUE_ROW}
      title={issue.line > 0 ? `Line ${issue.line} — click to jump` : issue.message}
      onClick={() => { if (issue.line > 0) scrollToLine(issue.line) }}
    >
      <span className="lint-issue-badge">{SEVERITY_LABEL[issue.severity]}</span>
      <span className="lint-issue-message">{issue.message}</span>
      {issue.line > 0 && <span className="lint-issue-line">:{issue.line}</span>}
      <span className="lint-issue-actions">
        {hasDeterministicFix && (
          <button
            className="lint-fix-btn"
            title="Auto-fix this issue"
            disabled={fixing !== null}
            onClick={(e) => { e.stopPropagation(); applyFix('det') }}
          >
            {fixing === 'det' ? '…' : <WrenchIcon />}
          </button>
        )}
        <button
          className="lint-fix-btn lint-fix-btn--llm"
          title="Fix with AI"
          disabled={fixing !== null}
          onClick={(e) => { e.stopPropagation(); applyFix('llm') }}
        >
          {fixing === 'llm' ? '…' : <SparkleIcon />}
        </button>
      </span>
    </div>
  )
}

function RuleGroup({
  ruleId,
  issues,
  filePath,
  onFixed
}: {
  ruleId: string
  issues: LintIssue[]
  filePath: string
  onFixed: () => void
}) {
  const [fixing, setFixing] = useState<'det' | 'llm' | null>(null)
  const hasDeterministicFix = getDeterministicFixer(ruleId) !== null
  const severity = issues[0].severity

  async function fixAll(kind: 'det' | 'llm') {
    setFixing(kind)
    try {
      await readFixWrite(
        filePath,
        (content) =>
          kind === 'det'
            ? applyFixAll(content, issues, ruleId)
            : applyLlmFixAll(content, issues),
        onFixed
      )
    } finally {
      setFixing(null)
    }
  }

  return (
    <div className="lint-rule-group">
      <div className={`lint-rule-header lint-rule-header--${severity}`}>
        <span className="lint-rule-name">{RULE_LABEL.get(ruleId) ?? ruleId}</span>
        <span className="lint-rule-count">{issues.length}</span>
        <span className="lint-rule-actions">
          {hasDeterministicFix && (
            <button
              className="lint-fix-btn"
              title={`Auto-fix all ${issues.length}`}
              disabled={fixing !== null}
              onClick={() => fixAll('det')}
            >
              {fixing === 'det' ? '…' : <WrenchIcon />}
            </button>
          )}
          <button
            className="lint-fix-btn lint-fix-btn--llm"
            title={`Fix all ${issues.length} with AI`}
            disabled={fixing !== null}
            onClick={() => fixAll('llm')}
          >
            {fixing === 'llm' ? '…' : <SparkleIcon />}
          </button>
        </span>
      </div>
      {issues.map((issue, i) => (
        <IssueRow
          key={`${issue.ruleId}-${issue.line}-${i}`}
          issue={issue}
          filePath={filePath}
          onFixed={onFixed}
        />
      ))}
    </div>
  )
}

function groupByRule(issues: LintIssue[]): Map<string, LintIssue[]> {
  const map = new Map<string, LintIssue[]>()
  for (const issue of issues) {
    const group = map.get(issue.ruleId) ?? []
    group.push(issue)
    map.set(issue.ruleId, group)
  }
  return map
}

export function LintPanel() {
  const { issues, running, lintFile } = useLintStore()
  const { phase: refactorPhase, error: refactorError, startRefactor } = useProseStore()
  const selection = useEditorStore((s) => s.selection)

  const filePath = selectedFilePath(selection)
  const fileIssues = filePath ? (issues[filePath] ?? []) : []
  const grouped = useMemo(() => groupByRule(fileIssues), [fileIssues])

  const errorCount = fileIssues.filter((i) => i.severity === 'error').length
  const warnCount = fileIssues.filter((i) => i.severity === 'warning').length
  const refactoring = refactorPhase !== RefactorPhase.idle

  function handleFixed() {
    if (filePath) lintFile(filePath)
  }

  return (
    <div className="lint-panel" data-testid={TEST_IDS.LINT_PANEL}>
      <div className="sidebar-header">
        <span>Doc Lint</span>
        {fileIssues.length > 0 && (
          <span className="lint-summary">
            {errorCount > 0 && <span className="lint-count lint-count--error">{errorCount}</span>}
            {warnCount > 0 && <span className="lint-count lint-count--warning">{warnCount}</span>}
          </span>
        )}
        {filePath && (
          <button
            className="lint-fix-btn lint-fix-btn--llm lint-refactor-btn"
            title="Refactor document with AI — de-duplicate, consolidate, tighten (shows a diff for review)"
            disabled={refactoring}
            onClick={() => startRefactor(filePath)}
          >
            {refactorPhase === RefactorPhase.running ? '…' : <SparkleIcon />}
          </button>
        )}
      </div>

      {refactorError && <div className="lint-refactor-error">{refactorError}</div>}
      <RefactorReviewDialog />

      <div className="lint-list">
        {!filePath ? (
          <div className="lint-empty">No file open</div>
        ) : running ? (
          <div className="lint-empty">Checking…</div>
        ) : fileIssues.length === 0 ? (
          <div className="lint-empty lint-empty--ok">No issues found</div>
        ) : (
          [...grouped.entries()].map(([ruleId, ruleIssues]) => (
            <RuleGroup
              key={ruleId}
              ruleId={ruleId}
              issues={ruleIssues}
              filePath={filePath}
              onFixed={handleFixed}
            />
          ))
        )}
      </div>
    </div>
  )
}
