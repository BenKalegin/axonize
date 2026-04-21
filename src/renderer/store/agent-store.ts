import { useEffect } from 'react'
import { create } from 'zustand'
import type { AgentEventBody, AgentEventPayload } from '../../preload'
import { AgentTurnKind, AgentTurnRole } from '@core/agent/turn-kinds'
import { classifyTurn, makePreview } from '@/lib/agent-turn-classifier'

export interface AgentTurn {
  id: string
  role: AgentTurnRole
  content: string
  kind?: AgentTurnKind
  preview?: string
  parentTurnId?: string | null
  toolTrace?: string[]
  createdAt: number
}

export interface AgentSession {
  id: string
  name: string
  turns: AgentTurn[]
  createdAt: number
  updatedAt: number
  claudeSessionId?: string
  allowEdits: boolean
  collapsed: boolean
}

export interface SelectedTurnRef {
  sessionId: string
  turnId: string
}

interface PersistedAgentState {
  sessions: AgentSession[]
  selectedSessionId: string | null
}

interface AgentStore {
  sessions: AgentSession[]
  promptDrafts: Record<string, string>
  selectedSessionId: string | null
  selectedTurn: SelectedTurnRef | null
  runningSessionId: string | null
  streamingText: string
  toolTrace: string[]
  error: string | null
  loadedVaultKey: string | null
  hydrate: (vaultPath: string | null) => void
  createSession: (vaultPath: string | null) => void
  deleteSession: (vaultPath: string | null, sessionId: string) => void
  selectSession: (sessionId: string) => void
  selectTurn: (ref: SelectedTurnRef | null) => void
  toggleSessionCollapsed: (vaultPath: string | null, sessionId: string) => void
  setAllowEdits: (vaultPath: string | null, sessionId: string, allowEdits: boolean) => void
  updatePromptDraft: (sessionId: string, promptDraft: string) => void
  sendPrompt: (vaultPath: string | null, sessionId: string) => void
  cancelPrompt: (sessionId: string) => void
  handleEvent: (vaultPath: string | null, payload: AgentEventPayload) => void
}

const STORAGE_PREFIX_V3 = 'axonize.agent.sessions.v3'
const STORAGE_PREFIX_V2 = 'axonize.agent.sessions.v2'
const SESSION_NAME_MAX_CHARS = 52
const TOOL_TRACE_MAX = 20
const TOOL_ERROR_PREVIEW_MAX_CHARS = 120
const TOOL_INPUT_VALUE_MAX_CHARS = 80
const EMPTY_ASSISTANT_RESPONSE = '(empty response)'

function storageKeyV3(vaultPath: string | null): string {
  return `${STORAGE_PREFIX_V3}:${vaultPath ?? '__global__'}`
}

function storageKeyV2(vaultPath: string | null): string {
  return `${STORAGE_PREFIX_V2}:${vaultPath ?? '__global__'}`
}

function emptySession(index: number): AgentSession {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: `Session ${index}`,
    turns: [],
    createdAt: now,
    updatedAt: now,
    allowEdits: false,
    collapsed: false
  }
}

function clip(text: string, max = SESSION_NAME_MAX_CHARS): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function deriveNameFromSession(session: AgentSession, fallbackIndex: number): string {
  const firstUserTurn = session.turns.find(
    (turn) => turn.role === AgentTurnRole.User && turn.content.trim().length > 0
  )
  if (firstUserTurn) {
    return clip(firstUserTurn.content)
  }
  return `Session ${fallbackIndex}`
}

function normalizeSessions(sessions: AgentSession[]): AgentSession[] {
  return sessions
    .map((session, index) => ({
      ...session,
      allowEdits: session.allowEdits ?? false,
      collapsed: session.collapsed ?? false,
      name: deriveNameFromSession(session, index + 1)
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

function buildAssistantTurn(content: string, toolTrace: string[] | undefined, id: string, createdAt: number): AgentTurn {
  return {
    id,
    role: AgentTurnRole.Assistant,
    content,
    kind: classifyTurn(content),
    preview: makePreview(content),
    parentTurnId: null,
    toolTrace: toolTrace && toolTrace.length > 0 ? [...toolTrace] : undefined,
    createdAt
  }
}

interface LegacyAgentMessage {
  id: string
  role: AgentTurnRole
  content: string
  toolTrace?: string[]
  createdAt: number
}

interface LegacyAgentSession {
  id: string
  name: string
  promptDraft?: string
  messages: LegacyAgentMessage[]
  createdAt: number
  updatedAt: number
  claudeSessionId?: string
  allowEdits?: boolean
}

function migrateLegacyTurn(message: LegacyAgentMessage): AgentTurn {
  if (message.role === AgentTurnRole.User) {
    return {
      id: message.id,
      role: AgentTurnRole.User,
      content: message.content,
      parentTurnId: null,
      toolTrace: message.toolTrace,
      createdAt: message.createdAt
    }
  }
  return buildAssistantTurn(message.content, message.toolTrace, message.id, message.createdAt)
}

function migrateLegacySession(session: LegacyAgentSession): AgentSession {
  return {
    id: session.id,
    name: session.name,
    turns: (session.messages ?? []).map(migrateLegacyTurn),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    claudeSessionId: session.claudeSessionId,
    allowEdits: session.allowEdits ?? false,
    collapsed: false
  }
}

function readV3(vaultPath: string | null): PersistedAgentState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(storageKeyV3(vaultPath))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedAgentState
    if (!Array.isArray(parsed.sessions)) return null
    return {
      sessions: normalizeSessions(parsed.sessions),
      selectedSessionId: parsed.selectedSessionId ?? null
    }
  } catch {
    return null
  }
}

function readLegacyV2AndMigrate(vaultPath: string | null): PersistedAgentState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(storageKeyV2(vaultPath))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { sessions?: LegacyAgentSession[]; selectedSessionId?: string | null }
    if (!Array.isArray(parsed.sessions)) return null
    const migrated: PersistedAgentState = {
      sessions: normalizeSessions(parsed.sessions.map(migrateLegacySession)),
      selectedSessionId: parsed.selectedSessionId ?? null
    }
    window.localStorage.setItem(storageKeyV3(vaultPath), JSON.stringify(migrated))
    window.localStorage.removeItem(storageKeyV2(vaultPath))
    return migrated
  } catch {
    return null
  }
}

function readPersisted(vaultPath: string | null): PersistedAgentState | null {
  return readV3(vaultPath) ?? readLegacyV2AndMigrate(vaultPath)
}

function persist(vaultPath: string | null, state: PersistedAgentState): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(storageKeyV3(vaultPath), JSON.stringify(state))
  } catch {
    // localStorage can throw on quota exceeded; dropping the write is preferable to crashing the UI.
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
    const preview = event.result.slice(0, TOOL_ERROR_PREVIEW_MAX_CHARS).replace(/\s+/g, ' ')
    return `✗ ${preview}`
  }
  return null
}

function summarizeInput(input: Record<string, unknown>): string {
  const keys = ['path', 'file_path', 'pattern', 'question', 'command']
  for (const key of keys) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      return `${key}=${(input[key] as string).slice(0, TOOL_INPUT_VALUE_MAX_CHARS)}`
    }
  }
  return ''
}

export const useAgentStore = create<AgentStore>((set, get) => {
  const appendAssistantTurn = (vaultPath: string | null, sessionId: string, content: string): AgentSession[] => {
    const turn = buildAssistantTurn(content, get().toolTrace, crypto.randomUUID(), Date.now())
    const sessions = updateSession(get().sessions, sessionId, (item) => ({
      ...item,
      turns: [...item.turns, turn],
      updatedAt: Date.now()
    }))
    persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
    return sessions
  }

  return {
    sessions: [],
    promptDrafts: {},
    selectedSessionId: null,
    selectedTurn: null,
    runningSessionId: null,
    streamingText: '',
    toolTrace: [],
    error: null,
    loadedVaultKey: null,

    hydrate: (vaultPath) => {
      const key = storageKeyV3(vaultPath)
      if (get().loadedVaultKey === key) {
        return
      }

      const persisted = readPersisted(vaultPath)
      const sessions = persisted?.sessions?.length
        ? persisted.sessions
        : [emptySession(1)]
      const selectedSessionId = ensureSelection(sessions, persisted?.selectedSessionId ?? null)

      set({
        sessions,
        promptDrafts: {},
        selectedSessionId,
        selectedTurn: null,
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
      const nextSession = emptySession(current.length + 1)
      const sessions = normalizeSessions([nextSession, ...current])
      const selectedSessionId = nextSession.id
      set({ sessions, selectedSessionId, selectedTurn: null, error: null })
      persist(vaultPath, { sessions, selectedSessionId })
    },

    deleteSession: (vaultPath, sessionId) => {
      const sessions = normalizeSessions(get().sessions.filter((session) => session.id !== sessionId))
      const currentSelected = get().selectedSessionId
      const selectedSessionId = ensureSelection(sessions, currentSelected === sessionId ? null : currentSelected)
      const selectedTurn = get().selectedTurn?.sessionId === sessionId ? null : get().selectedTurn
      set({ sessions, selectedSessionId, selectedTurn, error: null })
      persist(vaultPath, { sessions, selectedSessionId })
    },

    selectSession: (sessionId) => {
      set({ selectedSessionId: sessionId, selectedTurn: null, error: null })
    },

    selectTurn: (ref) => {
      set({ selectedTurn: ref })
    },

    toggleSessionCollapsed: (vaultPath, sessionId) => {
      const sessions = updateSession(get().sessions, sessionId, (session) => ({
        ...session,
        collapsed: !session.collapsed
      }))
      set({ sessions })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
    },

    setAllowEdits: (vaultPath, sessionId, allowEdits) => {
      const sessions = updateSession(get().sessions, sessionId, (session) => ({
        ...session,
        allowEdits,
        updatedAt: Date.now()
      }))
      set({ sessions, error: null })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
    },

    updatePromptDraft: (sessionId, promptDraft) => {
      set({ promptDrafts: { ...get().promptDrafts, [sessionId]: promptDraft }, error: null })
    },

    sendPrompt: (vaultPath, sessionId) => {
      const session = get().sessions.find((item) => item.id === sessionId)
      if (!session) return
      const prompt = (get().promptDrafts[sessionId] ?? '').trim()
      if (!prompt || get().runningSessionId) return

      const userTurn: AgentTurn = {
        id: crypto.randomUUID(),
        role: AgentTurnRole.User,
        content: prompt,
        parentTurnId: null,
        createdAt: Date.now()
      }

      const sessions = updateSession(get().sessions, sessionId, (item) => ({
        ...item,
        turns: [...item.turns, userTurn],
        updatedAt: Date.now()
      }))
      const nextDrafts = { ...get().promptDrafts }
      delete nextDrafts[sessionId]

      set({
        sessions,
        promptDrafts: nextDrafts,
        runningSessionId: sessionId,
        streamingText: '',
        toolTrace: [],
        error: null
      })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })

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
        const sessions = appendAssistantTurn(vaultPath, sessionId, `Agent error: ${event.error}`)
        set({ sessions, error: event.error, streamingText: '', toolTrace: [] })
        return
      }

      if (event.type === 'done') {
        const finalText = get().streamingText.trim() || EMPTY_ASSISTANT_RESPONSE
        const sessions = appendAssistantTurn(vaultPath, sessionId, finalText)
        set({ sessions, streamingText: '', toolTrace: [] })
        return
      }

      if (event.type === 'closed') {
        set({ runningSessionId: null })
        return
      }
    }
  }
})

export function useAgentBootstrap(vaultPath: string | null): void {
  const hydrate = useAgentStore((s) => s.hydrate)
  const handleEvent = useAgentStore((s) => s.handleEvent)

  useEffect(() => {
    hydrate(vaultPath)
  }, [hydrate, vaultPath])

  useEffect(() => {
    return window.axonize.agent.onEvent((payload) => handleEvent(vaultPath, payload))
  }, [handleEvent, vaultPath])
}
