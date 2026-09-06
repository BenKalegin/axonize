import { readdir, unlink, mkdir, rm, writeFile, rename, stat, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { getSettings } from './settings-service'
import type {
  AgentTurnFrontmatter,
  AgentTurnMeta,
  SaveAgentTurnPayload
} from '../core/agent/history-types'
import log from './logger'

const AGENT_HISTORY_DIR = '.axonize/agent-history'
const MS_PER_DAY = 24 * 60 * 60 * 1000
const FRONTMATTER_BOUNDARY_RE = /^---\n[\s\S]*?\n---\n/

function historyRoot(vaultPath: string): string {
  return join(vaultPath, AGENT_HISTORY_DIR)
}

function sessionDir(vaultPath: string, sessionId: string): string {
  return join(historyRoot(vaultPath), sessionId)
}

function turnFilePath(vaultPath: string, sessionId: string, turnId: string): string {
  return join(sessionDir(vaultPath, sessionId), `${turnId}.md`)
}

function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, content, 'utf-8')
  await rename(tempPath, filePath)
}

function buildFrontmatter(fm: AgentTurnFrontmatter): string {
  const traceJson = fm.toolTrace && fm.toolTrace.length > 0
    ? JSON.stringify(fm.toolTrace)
    : '[]'
  const fields = [
    `sessionId: "${escape(fm.sessionId)}"`,
    `turnId: "${escape(fm.turnId)}"`,
    `role: "${fm.role}"`,
    `createdAt: "${fm.createdAt}"`,
    `prompt: "${escape(fm.prompt)}"`,
    `toolTrace: ${traceJson}`
  ].join('\n')
  return `---\n${fields}\n---\n`
}

export async function saveAgentTurn(
  vaultPath: string,
  payload: SaveAgentTurnPayload
): Promise<AgentTurnMeta> {
  const createdAt = new Date().toISOString()
  const filePath = turnFilePath(vaultPath, payload.sessionId, payload.turnId)
  await mkdir(sessionDir(vaultPath, payload.sessionId), { recursive: true })

  const frontmatter: AgentTurnFrontmatter = {
    sessionId: payload.sessionId,
    turnId: payload.turnId,
    role: payload.role,
    createdAt,
    prompt: payload.prompt,
    toolTrace: payload.toolTrace
  }
  const content = buildFrontmatter(frontmatter) + payload.answer
  await writeAtomic(filePath, content)

  return { ...frontmatter, filePath }
}

export async function deleteAgentSession(vaultPath: string, sessionId: string): Promise<void> {
  await rm(sessionDir(vaultPath, sessionId), { recursive: true, force: true })
}

export async function deleteAgentTurns(
  vaultPath: string,
  sessionId: string,
  turnIds: string[]
): Promise<void> {
  for (const turnId of turnIds) {
    const filePath = turnFilePath(vaultPath, sessionId, turnId)
    try {
      await unlink(filePath)
    } catch {
      // user turns aren't persisted as files; ignore ENOENT
    }
  }
  try {
    const remaining = await readdir(sessionDir(vaultPath, sessionId))
    if (remaining.length === 0) {
      await rm(sessionDir(vaultPath, sessionId), { recursive: true, force: true })
    }
  } catch {
    // session dir already gone
  }
}

export async function promoteAgentTurn(filePath: string, targetPath: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8')
  const match = content.match(FRONTMATTER_BOUNDARY_RE)
  if (!match) throw new Error('Invalid agent turn file format')
  const body = content.slice(match[0].length)

  await mkdir(dirname(targetPath), { recursive: true })
  await writeAtomic(targetPath, body)
  await unlink(filePath)
}

async function unlinkExpiredInSession(vaultPath: string, sessionId: string, cutoffMs: number): Promise<number> {
  const dir = sessionDir(vaultPath, sessionId)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return 0
  }
  let removed = 0
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const filePath = join(dir, entry)
    try {
      const s = await stat(filePath)
      if (s.mtimeMs < cutoffMs) {
        await unlink(filePath)
        removed++
      }
    } catch {
      log.warn('Failed to stat/delete agent turn:', filePath)
    }
  }
  try {
    const remaining = await readdir(dir)
    if (remaining.length === 0) await rm(dir, { recursive: true, force: true })
  } catch {
    // dir already gone
  }
  return removed
}

export async function cleanupExpiredAgentTurns(vaultPath: string): Promise<number> {
  const settings = await getSettings()
  const retentionDays = settings.generatedDocs.retentionDays
  const cutoffMs = Date.now() - retentionDays * MS_PER_DAY

  let sessionIds: string[]
  try {
    sessionIds = await readdir(historyRoot(vaultPath))
  } catch {
    return 0
  }

  let removed = 0
  for (const sessionId of sessionIds) {
    removed += await unlinkExpiredInSession(vaultPath, sessionId, cutoffMs)
  }
  if (removed > 0) log.info(`Cleaned up ${removed} expired agent turn(s)`)
  return removed
}
