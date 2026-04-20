import { ipcMain, type WebContents } from 'electron'
import { getSettings } from './settings-service'
import { createAgent } from './agent/agent-factory'
import type { AgentEvent } from './agent/agent'
import log from './logger'

interface AgentStartPayload {
  sessionId: string
  prompt: string
  vaultPath: string
  allowEdits: boolean
  claudeSessionId?: string
  systemPrompt?: string
}

interface RunningAgent {
  abort: AbortController
  webContents: WebContents
}

const runningAgents = new Map<string, RunningAgent>()

export function registerAgentIpcHandlers(): void {
  ipcMain.on('agent:start', (event, payload: AgentStartPayload) => {
    void startAgent(event.sender, payload)
  })

  ipcMain.on('agent:cancel', (_event, payload: { sessionId: string }) => {
    const running = runningAgents.get(payload.sessionId)
    if (running) {
      running.abort.abort()
    }
  })
}

async function startAgent(webContents: WebContents, payload: AgentStartPayload): Promise<void> {
  const { sessionId } = payload
  const existing = runningAgents.get(sessionId)
  if (existing) {
    existing.abort.abort()
  }

  const abort = new AbortController()
  runningAgents.set(sessionId, { abort, webContents })

  try {
    const settings = await getSettings()
    const agent = createAgent(settings.agent)

    for await (const event of agent.run({
      prompt: payload.prompt,
      vaultPath: payload.vaultPath,
      allowEdits: payload.allowEdits,
      claudeSessionId: payload.claudeSessionId,
      systemPrompt: payload.systemPrompt,
      abortSignal: abort.signal
    })) {
      sendEvent(webContents, sessionId, event)
    }
  } catch (error) {
    log.error('agent:start failed:', error)
    sendEvent(webContents, sessionId, {
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    runningAgents.delete(sessionId)
    sendEvent(webContents, sessionId, { type: 'closed' })
  }
}

type OutboundEvent = AgentEvent | { type: 'closed' }

function sendEvent(webContents: WebContents, sessionId: string, event: OutboundEvent): void {
  if (webContents.isDestroyed()) {
    return
  }
  webContents.send('agent:event', { sessionId, event })
}
