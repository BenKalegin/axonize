import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import type { AddressInfo } from 'net'
import { executeQuery } from '../rag/query-service'
import log from '../logger'

const HOST = '127.0.0.1'
const MAX_BODY_BYTES = 1024 * 64

export interface RagHttpServerHandle {
  port: number
  token: string
  close: () => Promise<void>
}

let cached: RagHttpServerHandle | null = null

export async function getRagHttpServer(): Promise<RagHttpServerHandle> {
  if (cached) {
    return cached
  }
  cached = await startRagHttpServer()
  return cached
}

async function startRagHttpServer(): Promise<RagHttpServerHandle> {
  const token = randomBytes(24).toString('hex')
  const server = createServer((req, res) => handleRequest(req, res, token).catch((err) => {
    log.error('rag-http: handler error', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
    }
  }))

  const port = await listen(server)
  log.info(`rag-http: listening on 127.0.0.1:${port}`)
  return { port, token, close: () => closeServer(server) }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, HOST, () => {
      const addr = server.address() as AddressInfo
      resolve(addr.port)
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, token: string): Promise<void> {
  if (req.method !== 'POST' || req.url !== '/rag/query') {
    res.writeHead(404).end()
    return
  }
  if (req.headers['x-axonize-token'] !== token) {
    res.writeHead(401).end()
    return
  }

  const body = await readBody(req)
  const payload = JSON.parse(body) as { vaultPath: string; question: string }
  const result = await executeQuery(payload.vaultPath, payload.question)

  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(result))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}
