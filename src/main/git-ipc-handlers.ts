import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import type { LLMMessage } from '../core/rag/types'
import { GitStatus } from '../core/git/types'
import type { GitFileStatus } from '../core/git/types'
import log from './logger'

const execFileAsync = promisify(execFile)

const MAX_DIFF_CHARS_FOR_SUGGESTION = 12000

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 1024 * 1024 })
  return stdout
}

const STATUS_LABELS: Record<string, GitFileStatus['status']> = {
  M: GitStatus.Modified,
  A: GitStatus.Added,
  D: GitStatus.Deleted,
  R: GitStatus.Renamed,
  C: GitStatus.Copied,
  '?': GitStatus.Untracked,
}

function parseStatusOutput(output: string): GitFileStatus[] {
  const results: GitFileStatus[] = []
  for (const line of output.split('\n')) {
    if (line.length < 4) continue
    const index = line[0]
    const workTree = line[1]
    const path = line.slice(3)

    if (index !== ' ' && index !== '?') {
      results.push({ path, status: STATUS_LABELS[index] ?? GitStatus.Modified, staged: true })
    }
    if (workTree !== ' ' || index === '?') {
      const code = workTree === '?' ? '?' : workTree
      results.push({ path, status: STATUS_LABELS[code] ?? GitStatus.Modified, staged: false })
    }
  }
  return results
}

function gitHandler<P>(channel: string, fn: (payload: P) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, payload: P) => {
    try {
      return await fn(payload)
    } catch (e) {
      log.error(`${channel} failed:`, e)
      throw e
    }
  })
}

export function registerGitIpcHandlers(): void {
  gitHandler('git:status', async (payload: { cwd: string }) => {
    const output = await runGit(payload.cwd, ['status', '--porcelain'])
    return parseStatusOutput(output)
  })

  gitHandler('git:diff', async (payload: { cwd: string; staged: boolean }) => {
    const args = payload.staged ? ['diff', '--cached'] : ['diff']
    return await runGit(payload.cwd, args)
  })

  gitHandler('git:stage', async (payload: { cwd: string; filePath: string }) => {
    await runGit(payload.cwd, ['add', '--', payload.filePath])
  })

  gitHandler('git:unstage', async (payload: { cwd: string; filePath: string }) => {
    await runGit(payload.cwd, ['reset', 'HEAD', '--', payload.filePath])
  })

  gitHandler('git:stageAll', async (payload: { cwd: string }) => {
    await runGit(payload.cwd, ['add', '-A'])
  })

  gitHandler('git:unstageAll', async (payload: { cwd: string }) => {
    await runGit(payload.cwd, ['reset', 'HEAD'])
  })

  gitHandler('git:commit', async (payload: { cwd: string; message: string }) => {
    await runGit(payload.cwd, ['commit', '-m', payload.message])
  })

  gitHandler('git:suggestCommitMessage', async (payload: { cwd: string }) => {
    const diff = await runGit(payload.cwd, ['diff', '--cached'])
    if (!diff.trim()) {
      return 'No staged changes to describe'
    }

    const truncatedDiff = diff.length > MAX_DIFF_CHARS_FOR_SUGGESTION
      ? diff.slice(0, MAX_DIFF_CHARS_FOR_SUGGESTION) + '\n... (truncated)'
      : diff

    const settings = await getSettings()
    const llm = getLLMProvider(settings.llm)

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You are a git commit message assistant. ' +
          'Given a git diff, write a concise, conventional commit message. ' +
          'Use imperative mood (e.g. "Add feature" not "Added feature"). ' +
          'Keep the subject line under 72 characters. ' +
          'Return ONLY the commit message, no explanation or formatting.'
      },
      {
        role: 'user',
        content: `Write a commit message for this diff:\n\n${truncatedDiff}`
      }
    ]

    const response = await llm.complete(messages)
    return response.content.trim()
  })

  gitHandler('git:isRepo', async (payload: { cwd: string }) => {
    try {
      await runGit(payload.cwd, ['rev-parse', '--is-inside-work-tree'])
      return true
    } catch {
      return false
    }
  })

  gitHandler('git:root', async (payload: { cwd: string }) => {
    try {
      const root = await runGit(payload.cwd, ['rev-parse', '--show-toplevel'])
      return root.trim()
    } catch {
      return null
    }
  })
}
