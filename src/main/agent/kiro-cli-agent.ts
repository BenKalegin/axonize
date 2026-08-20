import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import { constants } from 'fs'
import { homedir } from 'os'
import { access, mkdir, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { stripVTControlCharacters } from 'util'
import type { Agent, AgentEvent, AgentStartParams } from './agent'
import { AgentEventType } from './agent'
import { getRagHttpServer } from './rag-http-server'
import { writeRagMcpBridgeScript } from './rag-mcp-bridge'
import { RAG_MCP_SERVER_NAME } from './rag-mcp-server'
import { DIAGRAM_BLOCKS_INSTRUCTION } from '../prompts/diagram-prompts'
import { HTML_ISLAND_INSTRUCTION } from '../prompts/html-island-prompts'
import log from '../logger'

interface KiroCliAgentDeps {
  model: string
  kiroCliPath: string
}

interface KiroAgentConfigParams {
  agentName: string
  bridgePath: string
  model: string
  allowEdits: boolean
  systemPrompt: string
}

interface KiroSession {
  sessionId: string
  updatedAt?: string
}

interface KiroSessionGroup {
  cwd?: string
  sessions?: KiroSession[]
}

const DEFAULT_CLI_PATH = 'kiro-cli'
const READ_ONLY_TOOLS = ['read', 'glob', 'grep', `@${RAG_MCP_SERVER_NAME}`]
const WRITE_TOOLS = ['write', 'shell']
const READ_ONLY_TRUSTED_TOOL_IDS = ['fs_read', `@${RAG_MCP_SERVER_NAME}`]

export class KiroCliAgent implements Agent {
  constructor(private readonly deps: KiroCliAgentDeps) {}

  async *run(params: AgentStartParams): AsyncIterable<AgentEvent> {
    const cliPath = await resolveKiroCliPath(this.deps.kiroCliPath)
    const rag = await getRagHttpServer()
    const bridgePath = await writeRagMcpBridgeScript({
      port: rag.port,
      token: rag.token,
      vaultPath: params.vaultPath
    })

    const agentName = `axonize-${randomUUID()}`
    const agentConfigPath = await writeKiroAgentConfig(params.vaultPath, {
      agentName,
      bridgePath,
      model: this.deps.model,
      allowEdits: params.allowEdits,
      systemPrompt: params.systemPrompt ?? defaultKiroSystemPrompt()
    })

    const knownSessionIds = await listKiroSessions(cliPath, params.vaultPath)
      .then((sessions) => new Set(sessions.map((session) => session.sessionId)))
      .catch((error) => {
        log.warn('KiroCliAgent: failed to list sessions before run', error)
        return new Set<string>()
      })

    const args = buildCliArgs({
      agentName,
      model: this.deps.model,
      sessionId: params.claudeSessionId,
      allowEdits: params.allowEdits,
      prompt: params.prompt
    })

    log.info(`KiroCliAgent: spawning ${cliPath}`)

    const child = spawn(cliPath, args, {
      cwd: params.vaultPath,
      env: kiroEnv(),
      stdio: ['pipe', 'pipe', 'pipe']
    }) as ChildProcessWithoutNullStreams
    child.stdin.end()

    params.abortSignal.addEventListener('abort', () => child.kill('SIGTERM'), { once: true })

    const stderrCollector = collectStream(child.stderr)
    const exitPromise = waitForExit(child)
    let hasEmittedText = false

    try {
      for await (const chunk of child.stdout) {
        const text = cleanKiroOutputChunk(
          typeof chunk === 'string' ? chunk : chunk.toString('utf-8'),
          hasEmittedText
        )
        if (text) {
          hasEmittedText = true
          yield { type: AgentEventType.TextDelta, text }
        }
      }

      const { code, signal } = await exitPromise
      if (params.abortSignal.aborted || signal === 'SIGTERM') {
        return
      }
      if (code !== 0) {
        yield { type: AgentEventType.Error, error: `kiro-cli exited with code ${code}: ${await stderrCollector}` }
        return
      }

      const sessionId = await findCurrentSessionId(cliPath, params.vaultPath, knownSessionIds, params.claudeSessionId)
      if (sessionId) {
        yield { type: AgentEventType.Session, claudeSessionId: sessionId }
      }
      yield { type: AgentEventType.Done }
    } catch (error) {
      log.error('KiroCliAgent: stream error', error)
      yield { type: AgentEventType.Error, error: error instanceof Error ? error.message : String(error) }
    } finally {
      await removeGeneratedAgentConfig(agentConfigPath)
    }
  }
}

interface CliArgsParams {
  agentName: string
  model: string
  sessionId?: string
  allowEdits: boolean
  prompt: string
}

function buildCliArgs(params: CliArgsParams): string[] {
  const args = [
    'chat',
    '--no-interactive',
    '--wrap',
    'never',
    '--require-mcp-startup',
    '--agent',
    params.agentName,
    ...buildKiroTrustArgs(params.allowEdits)
  ]

  const model = params.model.trim()
  if (model) {
    args.push('--model', model)
  }
  if (params.sessionId) {
    args.push('--resume-id', params.sessionId)
  }
  args.push(params.prompt)
  return args
}

async function writeKiroAgentConfig(
  vaultPath: string,
  params: KiroAgentConfigParams
): Promise<string> {
  const configPath = join(vaultPath, '.kiro', 'agents', `${params.agentName}.json`)
  await mkdir(dirname(configPath), { recursive: true })
  const config = {
    name: params.agentName,
    description: 'Temporary Axonize agent bridge.',
    prompt: params.systemPrompt,
    model: params.model.trim() || undefined,
    includeMcpJson: true,
    mcpServers: {
      [RAG_MCP_SERVER_NAME]: {
        command: process.execPath,
        args: [params.bridgePath],
        env: { ELECTRON_RUN_AS_NODE: '1' },
        timeout: 120000
      }
    },
    tools: allowedKiroTools(params.allowEdits),
    allowedTools: allowedKiroTools(params.allowEdits),
    toolsSettings: kiroToolSettings(params.allowEdits)
  }
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  return configPath
}

function allowedKiroTools(allowEdits: boolean): string[] {
  return allowEdits ? [...READ_ONLY_TOOLS, ...WRITE_TOOLS] : READ_ONLY_TOOLS
}

function buildKiroTrustArgs(allowEdits: boolean): string[] {
  if (allowEdits) return ['--trust-all-tools']
  return [`--trust-tools=${READ_ONLY_TRUSTED_TOOL_IDS.join(',')}`]
}

function kiroToolSettings(allowEdits: boolean): Record<string, unknown> {
  if (!allowEdits) {
    return {
      read: { allowedPaths: ['./**'] },
      glob: { allowedPaths: ['./**'], allowReadOnly: true },
      write: { deniedPaths: ['./**'] },
      shell: { denyByDefault: true }
    }
  }
  return {
    read: { allowedPaths: ['./**'] },
    glob: { allowedPaths: ['./**'], allowReadOnly: true },
    write: { allowedPaths: ['./**'] },
    shell: { autoAllowReadonly: true }
  }
}

async function findCurrentSessionId(
  cliPath: string,
  cwd: string,
  knownSessionIds: Set<string>,
  preferredSessionId?: string
): Promise<string | null> {
  try {
    const sessions = await listKiroSessions(cliPath, cwd)
    if (preferredSessionId && sessions.some((session) => session.sessionId === preferredSessionId)) {
      return preferredSessionId
    }
    const newSession = sortedByUpdatedAt(sessions).find((session) => !knownSessionIds.has(session.sessionId))
    return newSession?.sessionId ?? sortedByUpdatedAt(sessions)[0]?.sessionId ?? null
  } catch (error) {
    log.warn('KiroCliAgent: failed to list sessions after run', error)
    return preferredSessionId ?? null
  }
}

async function listKiroSessions(cliPath: string, cwd: string): Promise<KiroSession[]> {
  const child = spawn(cliPath, ['chat', '--list-sessions', '--format', 'json'], {
    cwd,
    env: kiroEnv(),
    stdio: ['pipe', 'pipe', 'pipe']
  }) as ChildProcessWithoutNullStreams
  child.stdin.end()

  const stdoutCollector = collectStream(child.stdout)
  const stderrCollector = collectStream(child.stderr)
  const { code } = await waitForExit(child)
  const stdout = await stdoutCollector
  if (code !== 0) {
    throw new Error(`kiro-cli session list exited with code ${code}: ${await stderrCollector}`)
  }

  const parsed = JSON.parse(stdout) as unknown
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(isKiroSessionGroup)
    .flatMap((group) => group.sessions ?? [])
    .filter((session): session is KiroSession => typeof session.sessionId === 'string')
}

function sortedByUpdatedAt(sessions: KiroSession[]): KiroSession[] {
  return [...sessions].sort((left, right) => {
    const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0
    const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0
    return rightTime - leftTime
  })
}

function isKiroSessionGroup(value: unknown): value is KiroSessionGroup {
  return typeof value === 'object' && value !== null && Array.isArray((value as KiroSessionGroup).sessions)
}

async function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
  let buffer = ''
  for await (const chunk of stream) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
  }
  return buffer.trim()
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<{
  code: number | null
  signal: NodeJS.Signals | null
}> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
}

async function removeGeneratedAgentConfig(configPath: string): Promise<void> {
  try {
    await rm(configPath, { force: true })
  } catch (error) {
    log.warn('KiroCliAgent: failed to remove temporary agent config', error)
  }
}

function kiroEnv(): NodeJS.ProcessEnv {
  const pathParts = [
    join(homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH ?? ''
  ].filter(Boolean)

  return {
    ...process.env,
    PATH: pathParts.join(':'),
    KIRO_LOG_NO_COLOR: '1',
    NO_COLOR: '1'
  }
}

async function resolveKiroCliPath(configuredPath: string): Promise<string> {
  const trimmed = configuredPath.trim()
  if (trimmed) return expandHomePath(trimmed)

  for (const candidate of commonKiroCliPaths()) {
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Keep looking; falling back to PATH is still fine for terminal launches.
    }
  }
  return DEFAULT_CLI_PATH
}

function expandHomePath(filePath: string): string {
  if (filePath === '~') return homedir()
  if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2))
  return filePath
}

function commonKiroCliPaths(): string[] {
  return [
    join(homedir(), '.local', 'bin', 'kiro-cli'),
    '/opt/homebrew/bin/kiro-cli',
    '/usr/local/bin/kiro-cli'
  ]
}

function cleanKiroOutputChunk(chunk: string, hasEmittedText: boolean): string {
  let text = stripVTControlCharacters(chunk).replace(/\r/g, '')
  if (!hasEmittedText) {
    text = text.replace(/^\s*>\s*/, '')
  }
  return text
}

function defaultKiroSystemPrompt(): string {
  const guidance = [
    'You are Axonize Agent, an expert assistant working inside a markdown documentation vault.',
    'The current working directory is the vault root. Use read, glob, and grep to explore files, and the axonize-rag MCP server for semantic questions across the whole vault.',
    'When asked to edit docs, use write or shell only if the user has explicitly granted edit permission for this session. If edit tools are unavailable, stop and ask the user to enable edits.',
    'For mathematical notation in markdown, use $...$ for inline LaTeX and $$...$$ for display equations. Never wrap equations in backticks; backticks are for literal code. When repairing converted papers, normalize artifacts such as escaped math underscores (d\\_i -> d_i) and command-subscript asterisks (\\prod*{...} -> \\prod_{...}) inside math.',
    'Be concise and prefer the smallest change that satisfies the request. When referring to specific vault files, cite them as markdown links with the vault-relative path as both text and target, e.g. [eval/plan.md](eval/plan.md), so they are clickable.'
  ].join(' ')
  return `${guidance}\n\n${DIAGRAM_BLOCKS_INSTRUCTION}\n\n${HTML_ISLAND_INSTRUCTION}`
}
