import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { Agent, AgentEvent, AgentStartParams } from './agent'
import { AgentEventType } from './agent'
import { getRagHttpServer } from './rag-http-server'
import { writeRagMcpBridgeScript } from './rag-mcp-bridge'
import { RAG_MCP_SERVER_NAME } from './rag-mcp-server'
import { allowedTools, defaultSystemPrompt, disallowedTools } from './claude-tool-config'
import { extractSessionId, translateSdkMessage } from './sdk-message-translator'
import log from '../logger'

interface TtyAgentDeps {
  model: string
  claudeCliPath: string
}

const DEFAULT_CLI_PATH = 'claude'

export class ClaudeCodeTtyAgent implements Agent {
  constructor(private readonly deps: TtyAgentDeps) {}

  async *run(params: AgentStartParams): AsyncIterable<AgentEvent> {
    const rag = await getRagHttpServer()
    const bridgePath = await writeRagMcpBridgeScript({
      port: rag.port,
      token: rag.token,
      vaultPath: params.vaultPath
    })
    const mcpConfigPath = await writeMcpConfig(bridgePath)

    const args = buildCliArgs({
      model: this.deps.model,
      claudeSessionId: params.claudeSessionId,
      mcpConfigPath,
      allowEdits: params.allowEdits,
      systemPrompt: params.systemPrompt ?? defaultSystemPrompt()
    })

    const cliPath = this.deps.claudeCliPath || DEFAULT_CLI_PATH
    log.info(`ClaudeCodeTtyAgent: spawning ${cliPath}`)

    const child = spawn(cliPath, args, {
      cwd: params.vaultPath,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    }) as ChildProcessWithoutNullStreams

    child.stdin.end(params.prompt)
    params.abortSignal.addEventListener('abort', () => child.kill('SIGTERM'), { once: true })

    const stderrCollector = collectStderr(child.stderr)
    let lastSessionId: string | null = null

    try {
      for await (const message of iterateNdjson(child.stdout)) {
        const sessionId = extractSessionId(message)
        if (sessionId && sessionId !== lastSessionId) {
          lastSessionId = sessionId
          yield { type: AgentEventType.Session, claudeSessionId: sessionId }
        }
        for (const event of translateSdkMessage(message)) {
          yield event
        }
      }

      const { code } = await waitForExit(child)
      if (code !== 0) {
        yield { type: AgentEventType.Error, error: `claude exited with code ${code}: ${await stderrCollector}` }
      }
    } catch (error) {
      log.error('ClaudeCodeTtyAgent: stream error', error)
      yield { type: AgentEventType.Error, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

interface CliArgsParams {
  model: string
  claudeSessionId?: string
  mcpConfigPath: string
  allowEdits: boolean
  systemPrompt: string
}

function buildCliArgs(params: CliArgsParams): string[] {
  const args: string[] = [
    '--print',
    '--input-format', 'text',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--model', params.model,
    '--mcp-config', params.mcpConfigPath,
    '--append-system-prompt', params.systemPrompt,
    '--allowedTools', allowedTools(params.allowEdits).join(',')
  ]
  if (params.claudeSessionId) {
    args.push('--resume', params.claudeSessionId)
  }
  const blocked = disallowedTools(params.allowEdits)
  if (blocked.length > 0) {
    args.push('--disallowedTools', blocked.join(','))
  }
  return args
}

async function writeMcpConfig(bridgePath: string): Promise<string> {
  const dir = join(app.getPath('temp'), 'axonize-agent')
  await mkdir(dir, { recursive: true })
  const configPath = join(dir, 'mcp-config.json')
  const config = {
    mcpServers: {
      [RAG_MCP_SERVER_NAME]: {
        type: 'stdio',
        command: process.execPath,
        args: [bridgePath],
        env: { ELECTRON_RUN_AS_NODE: '1' }
      }
    }
  }
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  return configPath
}

async function* iterateNdjson(stream: NodeJS.ReadableStream): AsyncIterable<unknown> {
  let buffer = ''
  for await (const chunk of stream) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        try {
          yield JSON.parse(line)
        } catch (err) {
          log.warn('tty-agent: failed to parse NDJSON line', err)
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }
  const remaining = buffer.trim()
  if (remaining) {
    try {
      yield JSON.parse(remaining)
    } catch {
      // ignore trailing partial
    }
  }
}

async function collectStderr(stream: NodeJS.ReadableStream): Promise<string> {
  let buffer = ''
  for await (const chunk of stream) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
  }
  return buffer.trim()
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
}
