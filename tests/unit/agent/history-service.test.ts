import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir, stat, utimes } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  saveAgentTurn,
  deleteAgentSession,
  promoteAgentTurn,
  cleanupExpiredAgentTurns
} from '../../../src/main/agent-history-service'
import { AgentTurnRole } from '../../../src/core/agent/turn-kinds'

vi.mock('../../../src/main/settings-service', () => ({
  getSettings: async () => ({ generatedDocs: { retentionDays: 7 } })
}))

vi.mock('../../../src/main/logger', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {} }
}))

async function tempVault(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'axonize-agent-history-'))
}

describe('agent-history-service', () => {
  let vaultPath: string

  beforeEach(async () => {
    vaultPath = await tempVault()
  })

  afterEach(async () => {
    await rm(vaultPath, { recursive: true, force: true })
  })

  it('saves a turn as a markdown file with frontmatter', async () => {
    const meta = await saveAgentTurn(vaultPath, {
      sessionId: 's1',
      turnId: 't1',
      role: AgentTurnRole.Assistant,
      prompt: 'what is X?',
      answer: '# Answer\n\n**Bold** thing.',
      toolTrace: ['▸ Read path=/foo.md']
    })

    expect(meta.filePath).toContain('/.axonize/agent-history/s1/t1.md')

    const content = await readFile(meta.filePath, 'utf-8')
    expect(content).toMatch(/^---\nsessionId: "s1"\n/)
    expect(content).toMatch(/turnId: "t1"/)
    expect(content).toMatch(/role: "assistant"/)
    expect(content).toMatch(/prompt: "what is X\?"/)
    expect(content).toContain('toolTrace: ["▸ Read path=/foo.md"]')
    expect(content.endsWith('# Answer\n\n**Bold** thing.')).toBe(true)
  })

  it('escapes quotes and backslashes in frontmatter fields', async () => {
    const meta = await saveAgentTurn(vaultPath, {
      sessionId: 's1',
      turnId: 't1',
      role: AgentTurnRole.Assistant,
      prompt: 'has "quotes" and \\backslash\\',
      answer: 'body'
    })
    const content = await readFile(meta.filePath, 'utf-8')
    expect(content).toContain('prompt: "has \\"quotes\\" and \\\\backslash\\\\"')
  })

  it('deletes a session directory recursively', async () => {
    await saveAgentTurn(vaultPath, {
      sessionId: 's1', turnId: 't1',
      role: AgentTurnRole.Assistant, prompt: 'p', answer: 'a'
    })
    await deleteAgentSession(vaultPath, 's1')

    await expect(stat(join(vaultPath, '.axonize/agent-history/s1'))).rejects.toThrow()
  })

  it('deleteAgentSession is a no-op when dir is missing', async () => {
    await expect(deleteAgentSession(vaultPath, 'never-existed')).resolves.toBeUndefined()
  })

  it('promotes a turn: writes body to target, strips frontmatter, removes original', async () => {
    const meta = await saveAgentTurn(vaultPath, {
      sessionId: 's1', turnId: 't1',
      role: AgentTurnRole.Assistant,
      prompt: 'q', answer: 'PROMOTED BODY'
    })
    const targetPath = join(vaultPath, '_generated/s1/t1.md')
    await promoteAgentTurn(meta.filePath, targetPath)

    expect(await readFile(targetPath, 'utf-8')).toBe('PROMOTED BODY')
    await expect(stat(meta.filePath)).rejects.toThrow()
  })

  it('promote fails on a file without valid frontmatter', async () => {
    const filePath = join(vaultPath, 'plain.md')
    await writeFile(filePath, '# Just a plain markdown file')
    await expect(promoteAgentTurn(filePath, join(vaultPath, 'target.md'))).rejects.toThrow()
  })

  it('cleanupExpiredAgentTurns removes turns older than retention (by mtime)', async () => {
    const meta = await saveAgentTurn(vaultPath, {
      sessionId: 's1', turnId: 't1',
      role: AgentTurnRole.Assistant, prompt: 'q', answer: 'a'
    })
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await utimes(meta.filePath, old, old)

    const removed = await cleanupExpiredAgentTurns(vaultPath)
    expect(removed).toBe(1)
    await expect(stat(meta.filePath)).rejects.toThrow()
  })

  it('cleanup keeps turns within retention', async () => {
    await saveAgentTurn(vaultPath, {
      sessionId: 's1', turnId: 't1',
      role: AgentTurnRole.Assistant, prompt: 'q', answer: 'a'
    })
    const removed = await cleanupExpiredAgentTurns(vaultPath)
    expect(removed).toBe(0)
  })

  it('cleanup removes empty session directories', async () => {
    const meta = await saveAgentTurn(vaultPath, {
      sessionId: 's1', turnId: 't1',
      role: AgentTurnRole.Assistant, prompt: 'q', answer: 'a'
    })
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await utimes(meta.filePath, old, old)
    await cleanupExpiredAgentTurns(vaultPath)

    const root = join(vaultPath, '.axonize/agent-history')
    await mkdir(root, { recursive: true })
    const remaining = await readdir(root)
    expect(remaining).not.toContain('s1')
  })

  it('cleanup returns 0 when no history dir exists', async () => {
    expect(await cleanupExpiredAgentTurns(vaultPath)).toBe(0)
  })
})
