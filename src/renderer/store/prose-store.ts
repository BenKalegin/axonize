import { create } from 'zustand'
import type { LintIssue } from '@core/markdown/lint/types'
import { useLintStore } from './lint-store'

export const RefactorPhase = {
  idle: 'idle',
  running: 'running',
  review: 'review',
  applying: 'applying'
} as const
export type RefactorPhase = (typeof RefactorPhase)[keyof typeof RefactorPhase]

interface ProseState {
  phase: RefactorPhase
  filePath: string | null
  original: string | null
  refactored: string | null
  error: string | null
  startRefactor: (filePath: string) => Promise<void>
  apply: () => Promise<void>
  discard: () => void
}

function summarizeFindings(issues: LintIssue[]): string | undefined {
  if (issues.length === 0) return undefined
  return issues.map((i) => `- line ${i.line} [${i.ruleId}]: ${i.message}`).join('\n')
}

export const useProseStore = create<ProseState>((set, get) => ({
  phase: RefactorPhase.idle,
  filePath: null,
  original: null,
  refactored: null,
  error: null,

  startRefactor: async (filePath: string) => {
    if (get().phase !== RefactorPhase.idle) return
    set({ phase: RefactorPhase.running, filePath, error: null })
    try {
      const original = await window.axonize.file.read(filePath)
      const findings = useLintStore.getState().issues[filePath] ?? []
      const refactored = await window.axonize.prose.refactor({
        content: original,
        findingsSummary: summarizeFindings(findings)
      })
      if (refactored.trimEnd() === original.trimEnd()) {
        set({ phase: RefactorPhase.idle, filePath: null, error: 'No changes proposed — the document is already coherent' })
        return
      }
      set({ phase: RefactorPhase.review, original, refactored })
    } catch (e) {
      set({ phase: RefactorPhase.idle, filePath: null, error: String(e) })
    }
  },

  apply: async () => {
    const { phase, filePath, original, refactored } = get()
    if (phase !== RefactorPhase.review || !filePath || original === null || refactored === null) return
    set({ phase: RefactorPhase.applying })
    try {
      const current = await window.axonize.file.read(filePath)
      if (current !== original) {
        throw new Error('File changed since the refactor started — review discarded, run it again')
      }
      await window.axonize.file.write(filePath, refactored)
      useLintStore.getState().lintFile(filePath)
      set({ phase: RefactorPhase.idle, filePath: null, original: null, refactored: null, error: null })
    } catch (e) {
      set({ phase: RefactorPhase.idle, filePath: null, original: null, refactored: null, error: String(e) })
    }
  },

  discard: () => {
    set({ phase: RefactorPhase.idle, filePath: null, original: null, refactored: null, error: null })
  }
}))
