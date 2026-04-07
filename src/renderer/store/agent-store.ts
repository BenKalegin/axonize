import { create } from 'zustand'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface AgentSession {
  id: string
  name: string
  context: string
  promptDraft: string
  messages: AgentMessage[]
  createdAt: number
  updatedAt: number
}

interface PersistedAgentState {
  sessions: AgentSession[]
  selectedSessionId: string | null
}

interface AgentStore {
  sessions: AgentSession[]
  selectedSessionId: string | null
  runningSessionId: string | null
  error: string | null
  loadedVaultKey: string | null
  hydrate: (vaultPath: string | null) => void
  createSession: (vaultPath: string | null) => void
  deleteSession: (vaultPath: string | null, sessionId: string) => void
  selectSession: (sessionId: string) => void
  updateContext: (vaultPath: string | null, sessionId: string, context: string) => void
  updatePromptDraft: (vaultPath: string | null, sessionId: string, promptDraft: string) => void
  sendPrompt: (vaultPath: string | null, sessionId: string) => Promise<void>
}

const STORAGE_PREFIX = 'axonize.agent.sessions.v1'

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
    context: '',
    promptDraft: '',
    messages: [],
    createdAt: now,
    updatedAt: now
  }
}

function clip(text: string, max = 52): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function normalizeContextLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .trim()
}

function deriveNameFromSession(session: AgentSession, fallbackIndex: number): string {
  const contextLine = session.context
    .split('\n')
    .map((line) => normalizeContextLine(line))
    .find((line) => line.length > 0)
  if (contextLine) {
    return clip(contextLine)
  }

  const latestUserMessage = [...session.messages]
    .reverse()
    .find((message) => message.role === 'user' && message.content.trim().length > 0)
  if (latestUserMessage) {
    return clip(latestUserMessage.content)
  }

  return `Session ${fallbackIndex}`
}

function normalizeSessions(sessions: AgentSession[]): AgentSession[] {
  return sessions
    .map((session, index) => ({
      ...session,
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

export const useAgentStore = create<AgentStore>((set, get) => ({
  sessions: [],
  selectedSessionId: null,
  runningSessionId: null,
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
    const selectedSessionId = ensureSelection(sessions, get().selectedSessionId === sessionId ? null : get().selectedSessionId)
    set({ sessions, selectedSessionId, error: null })
    persist(vaultPath, { sessions, selectedSessionId })
  },

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId, error: null })
  },

  updateContext: (vaultPath, sessionId, context) => {
    const sessions = updateSession(get().sessions, sessionId, (session) => ({
      ...session,
      context,
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

  sendPrompt: async (vaultPath, sessionId) => {
    const session = get().sessions.find((item) => item.id === sessionId)
    if (!session) {
      return
    }
    const prompt = session.promptDraft.trim()
    if (!prompt || get().runningSessionId) {
      return
    }

    const userMessage: AgentMessage = {
      id: newId('agent-message'),
      role: 'user',
      content: prompt,
      createdAt: Date.now()
    }

    const withUserMessage = updateSession(get().sessions, sessionId, (item) => ({
      ...item,
      promptDraft: '',
      messages: [...item.messages, userMessage],
      updatedAt: Date.now()
    }))

    const selectedSessionId = ensureSelection(withUserMessage, get().selectedSessionId)
    set({
      sessions: withUserMessage,
      selectedSessionId,
      runningSessionId: sessionId,
      error: null
    })
    persist(vaultPath, { sessions: withUserMessage, selectedSessionId })

    try {
      const history = session.messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
      const result = await window.axonize.agent.chat({
        vaultPath: vaultPath ?? undefined,
        prompt,
        context: session.context,
        history
      })

      const assistantMessage: AgentMessage = {
        id: newId('agent-message'),
        role: 'assistant',
        content: result.answer.trim() || '(empty response)',
        createdAt: Date.now()
      }

      const sessions = updateSession(get().sessions, sessionId, (item) => ({
        ...item,
        messages: [...item.messages, assistantMessage],
        updatedAt: Date.now()
      }))
      const nextSelectedSessionId = ensureSelection(sessions, get().selectedSessionId)
      set({
        sessions,
        selectedSessionId: nextSelectedSessionId,
        runningSessionId: null,
        error: null
      })
      persist(vaultPath, { sessions, selectedSessionId: nextSelectedSessionId })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const sessions = updateSession(get().sessions, sessionId, (item) => ({
        ...item,
        messages: [
          ...item.messages,
          {
            id: newId('agent-message'),
            role: 'assistant',
            content: `Agent error: ${message}`,
            createdAt: Date.now()
          }
        ],
        updatedAt: Date.now()
      }))
      const nextSelectedSessionId = ensureSelection(sessions, get().selectedSessionId)
      set({
        sessions,
        selectedSessionId: nextSelectedSessionId,
        runningSessionId: null,
        error: message
      })
      persist(vaultPath, { sessions, selectedSessionId: nextSelectedSessionId })
    }
  }
}))
