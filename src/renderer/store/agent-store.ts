import { create } from 'zustand'
import type { AgentEventBody, AgentEventPayload } from '../../preload'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolTrace?: string[]
  createdAt: number
}

export interface AgentSession {
  id: string
  name: string
  promptDraft: string
  messages: AgentMessage[]
  createdAt: number
  updatedAt: number
  claudeSessionId?: string
  allowEdits: boolean
}

interface PersistedAgentState {
  sessions: AgentSession[]
  selectedSessionId: string | null
}

interface AgentStore {
  sessions: AgentSession[]
  selectedSessionId: string | null
  runningSessionId: string | null
  streamingText: string
  toolTrace: string[]
  error: string | null
  loadedVaultKey: string | null
  hydrate: (vaultPath: string | null) => void
  createSession: (vaultPath: string | null) => void
  deleteSession: (vaultPath: string | null, sessionId: string) => void
  selectSession: (sessionId: string) => void
  setAllowEdits: (vaultPath: string | null, sessionId: string, allowEdits: boolean) => void
  updatePromptDraft: (vaultPath: string | null, sessionId: string, promptDraft: string) => void
  sendPrompt: (vaultPath: string | null, sessionId: string) => void
  cancelPrompt: (sessionId: string) => void
  handleEvent: (vaultPath: string | null, payload: AgentEventPayload) => void
}

const STORAGE_PREFIX = 'axonize.agent.sessions.v2'
const SESSION_NAME_MAX_CHARS = 52
const TOOL_TRACE_MAX = 20

function storageKeyForVault(vaultPath: string | null): string {
  return `${STORAGE_PREFIX}:${vaultPath ?? '__global__'}`
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createSession(index: number): AgentSession {
  const now = Date.now()
  return {
    id: newId('agent-session'),
    name: `Session ${index}`,
    promptDraft: '',
    messages: [],
    createdAt: now,
    updatedAt: now,
    allowEdits: false
  }
}

function clip(text: string, max = SESSION_NAME_MAX_CHARS): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function deriveNameFromSession(session: AgentSession, fallbackIndex: number): string {
  const firstUserMessage = session.messages.find(
    (message) => message.role === 'user' && message.content.trim().length > 0
  )
  if (firstUserMessage) {
    return clip(firstUserMessage.content)
  }
  return `Session ${fallbackIndex}`
}

function normalizeSessions(sessions: AgentSession[]): AgentSession[] {
  return sessions
    .map((session, index) => ({
      ...session,
      allowEdits: session.allowEdits ?? false,
      name: deriveNameFromSession(session, index + 1)
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

function readPersisted(vaultPath: string | null): PersistedAgentState | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  try {
    const raw = window.localStorage.getItem(storageKeyForVault(vaultPath))
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as PersistedAgentState
    if (!Array.isArray(parsed.sessions)) {
      return null
    }
    return {
      sessions: normalizeSessions(parsed.sessions),
      selectedSessionId: parsed.selectedSessionId ?? null
    }
  } catch {
    return null
  }
}

function persist(vaultPath: string | null, state: PersistedAgentState): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  try {
    window.localStorage.setItem(storageKeyForVault(vaultPath), JSON.stringify(state))
  } catch {
    // ignore storage failures
  }
}

function ensureSelection(sessions: AgentSession[], selectedSessionId: string | null): string | null {
  if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
    return selectedSessionId
  }
  return sessions.length > 0 ? sessions[0].id : null
}

function updateSession(
  sessions: AgentSession[],
  sessionId: string,
  updater: (session: AgentSession) => AgentSession
): AgentSession[] {
  return normalizeSessions(
    sessions.map((session) => (session.id === sessionId ? updater(session) : session))
  )
}

function formatToolTrace(event: AgentEventBody): string | null {
  if (event.type === 'tool_use') {
    const input = event.input && typeof event.input === 'object' ? summarizeInput(event.input as Record<string, unknown>) : ''
    return `▸ ${event.toolName}${input ? ` ${input}` : ''}`
  }
  if (event.type === 'tool_result' && event.isError) {
    const preview = event.result.slice(0, 120).replace(/\s+/g, ' ')
    return `✗ ${preview}`
  }
  return null
}

function summarizeInput(input: Record<string, unknown>): string {
  const keys = ['path', 'file_path', 'pattern', 'question', 'command']
  for (const key of keys) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      return `${key}=${(input[key] as string).slice(0, 80)}`
    }
  }
  return ''
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  sessions: [],
  selectedSessionId: null,
  runningSessionId: null,
  streamingText: '',
  toolTrace: [],
  error: null,
  loadedVaultKey: null,

  hydrate: (vaultPath) => {
    const key = storageKeyForVault(vaultPath)
    if (get().loadedVaultKey === key) {
      return
    }

    const persisted = readPersisted(vaultPath)
    const sessions = persisted?.sessions?.length
      ? persisted.sessions
      : [createSession(1)]
    const selectedSessionId = ensureSelection(sessions, persisted?.selectedSessionId ?? null)

    set({
      sessions,
      selectedSessionId,
      runningSessionId: null,
      streamingText: '',
      toolTrace: [],
      error: null,
      loadedVaultKey: key
    })

    persist(vaultPath, { sessions, selectedSessionId })
  },

  createSession: (vaultPath) => {
    const current = get().sessions
    const nextSession = createSession(current.length + 1)
    const sessions = normalizeSessions([nextSession, ...current])
    const selectedSessionId = nextSession.id
    set({ sessions, selectedSessionId, error: null })
    persist(vaultPath, { sessions, selectedSessionId })
  },

  deleteSession: (vaultPath, sessionId) => {
    const sessions = normalizeSessions(get().sessions.filter((session) => session.id !== sessionId))
    const currentSelected = get().selectedSessionId
    const selectedSessionId = ensureSelection(sessions, currentSelected === sessionId ? null : currentSelected)
    set({ sessions, selectedSessionId, error: null })
    persist(vaultPath, { sessions, selectedSessionId })
  },

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId, error: null })
  },

  setAllowEdits: (vaultPath, sessionId, allowEdits) => {
    const sessions = updateSession(get().sessions, sessionId, (session) => ({
      ...session,
      allowEdits,
      updatedAt: Date.now()
    }))
    const selectedSessionId = ensureSelection(sessions, get().selectedSessionId)
    set({ sessions, selectedSessionId, error: null })
    persist(vaultPath, { sessions, selectedSessionId })
  },

  updatePromptDraft: (vaultPath, sessionId, promptDraft) => {
    const sessions = get().sessions.map((session) =>
      session.id === sessionId ? { ...session, promptDraft } : session
    )
    const selectedSessionId = ensureSelection(sessions, get().selectedSessionId)
    set({ sessions, selectedSessionId, error: null })
    persist(vaultPath, { sessions, selectedSessionId })
  },

  sendPrompt: (vaultPath, sessionId) => {
    const session = get().sessions.find((item) => item.id === sessionId)
    if (!session) return
    const prompt = session.promptDraft.trim()
    if (!prompt || get().runningSessionId) return

    const userMessage: AgentMessage = {
      id: newId('agent-message'),
      role: 'user',
      content: prompt,
      createdAt: Date.now()
    }

    const sessions = updateSession(get().sessions, sessionId, (item) => ({
      ...item,
      promptDraft: '',
      messages: [...item.messages, userMessage],
      updatedAt: Date.now()
    }))
    const selectedSessionId = ensureSelection(sessions, get().selectedSessionId)

    set({
      sessions,
      selectedSessionId,
      runningSessionId: sessionId,
      streamingText: '',
      toolTrace: [],
      error: null
    })
    persist(vaultPath, { sessions, selectedSessionId })

    window.axonize.agent.start({
      sessionId,
      prompt,
      vaultPath: vaultPath ?? '',
      allowEdits: session.allowEdits,
      claudeSessionId: session.claudeSessionId
    })
  },

  cancelPrompt: (sessionId) => {
    window.axonize.agent.cancel(sessionId)
  },

  handleEvent: (vaultPath, payload) => {
    const { sessionId, event } = payload
    if (get().runningSessionId !== sessionId) return

    if (event.type === 'session') {
      const sessions = updateSession(get().sessions, sessionId, (item) => ({
        ...item,
        claudeSessionId: event.claudeSessionId,
        updatedAt: Date.now()
      }))
      set({ sessions })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
      return
    }

    if (event.type === 'text_delta') {
      set({ streamingText: get().streamingText + event.text })
      return
    }

    if (event.type === 'tool_use' || event.type === 'tool_result') {
      const trace = formatToolTrace(event)
      if (trace) {
        set({ toolTrace: [...get().toolTrace, trace].slice(-TOOL_TRACE_MAX) })
      }
      return
    }

    if (event.type === 'error') {
      const sessions = updateSession(get().sessions, sessionId, (item) => ({
        ...item,
        messages: [
          ...item.messages,
          {
            id: newId('agent-message'),
            role: 'assistant',
            content: `Agent error: ${event.error}`,
            toolTrace: get().toolTrace.length > 0 ? [...get().toolTrace] : undefined,
            createdAt: Date.now()
          }
        ],
        updatedAt: Date.now()
      }))
      set({ sessions, error: event.error, streamingText: '', toolTrace: [] })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
      return
    }

    if (event.type === 'done') {
      const finalText = get().streamingText.trim() || '(empty response)'
      const sessions = updateSession(get().sessions, sessionId, (item) => ({
        ...item,
        messages: [
          ...item.messages,
          {
            id: newId('agent-message'),
            role: 'assistant',
            content: finalText,
            toolTrace: get().toolTrace.length > 0 ? [...get().toolTrace] : undefined,
            createdAt: Date.now()
          }
        ],
        updatedAt: Date.now()
      }))
      set({ sessions, streamingText: '', toolTrace: [] })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
      return
    }

    if (event.type === 'closed') {
      set({ runningSessionId: null })
      return
    }
  }
}))
