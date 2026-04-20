import { app } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { RAG_MCP_SERVER_NAME, RAG_MCP_TOOL_NAME } from './rag-mcp-server'

const BRIDGE_BASENAME = 'axonize-rag-mcp-bridge.mjs'

export interface BridgeConfig {
  port: number
  token: string
  vaultPath: string
}

export async function writeRagMcpBridgeScript(config: BridgeConfig): Promise<string> {
  const dir = join(app.getPath('temp'), 'axonize-agent')
  await mkdir(dir, { recursive: true })
  const scriptPath = join(dir, BRIDGE_BASENAME)
  await writeFile(scriptPath, buildBridgeScript(config), 'utf-8')
  return scriptPath
}

function buildBridgeScript(config: BridgeConfig): string {
  const json = JSON.stringify(config)
  const serverName = JSON.stringify(RAG_MCP_SERVER_NAME)
  const toolName = JSON.stringify(RAG_MCP_TOOL_NAME)
  return MCP_BRIDGE_TEMPLATE
    .replace('__CONFIG__', json)
    .replace('__SERVER_NAME__', serverName)
    .replace('__TOOL_NAME__', toolName)
}

const MCP_BRIDGE_TEMPLATE = `#!/usr/bin/env node
// Axonize RAG MCP stdio bridge. Generated at runtime — do not edit.
// Speaks the MCP JSON-RPC 2.0 protocol on stdin/stdout; proxies rag_query
// tool calls to a local HTTP server in the Electron main process.

import { createInterface } from 'readline'

const CONFIG = __CONFIG__
const SERVER_NAME = __SERVER_NAME__
const TOOL_NAME = __TOOL_NAME__
const PROTOCOL_VERSION = '2024-11-05'

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: 'Semantic search over the vault documentation.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Natural language question' }
    },
    required: ['question']
  }
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\\n')
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

async function handleRagQuery(question) {
  const url = 'http://127.0.0.1:' + CONFIG.port + '/rag/query'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-axonize-token': CONFIG.token },
    body: JSON.stringify({ vaultPath: CONFIG.vaultPath, question })
  })
  if (!res.ok) {
    throw new Error('rag_query HTTP ' + res.status)
  }
  const data = await res.json()
  const sources = (data.sources || []).slice(0, 6)
    .map(s => '- ' + s.filePath + ':' + s.startLine + '  (score=' + (s.score ?? 0).toFixed(3) + ')')
    .join('\\n')
  return 'Answer:\\n' + (data.answer || '(empty)') + '\\n\\nSources:\\n' + (sources || '(none)')
}

async function handle(request) {
  const { id, method, params } = request
  try {
    if (method === 'initialize') {
      respond(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: '0.1.0' }
      })
      return
    }
    if (method === 'tools/list') {
      respond(id, { tools: [TOOL_SCHEMA] })
      return
    }
    if (method === 'tools/call') {
      if (params?.name !== TOOL_NAME) {
        respondError(id, -32601, 'Unknown tool: ' + params?.name)
        return
      }
      const question = params?.arguments?.question
      if (typeof question !== 'string') {
        respondError(id, -32602, 'Missing question argument')
        return
      }
      const text = await handleRagQuery(question)
      respond(id, { content: [{ type: 'text', text }] })
      return
    }
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      return
    }
    if (id !== undefined) {
      respondError(id, -32601, 'Method not found: ' + method)
    }
  } catch (error) {
    if (id !== undefined) {
      respondError(id, -32603, error instanceof Error ? error.message : String(error))
    }
  }
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let req
  try { req = JSON.parse(trimmed) } catch { return }
  handle(req)
})
rl.on('close', () => process.exit(0))
`
