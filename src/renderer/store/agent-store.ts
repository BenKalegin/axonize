import { useEffect } from 'react'
import { create } from 'zustand'
import type { AgentEventBody, AgentEventPayload } from '../../preload'
import { AgentTurnKind, AgentTurnRole } from '@core/agent/turn-kinds'
import { AgentEventKind } from '@core/agent/event-kinds'
import type { AgentTurnMeta } from '@core/agent/history-types'
import { classifyTurn, makePreview, summarizeUserPrompt } from '@/lib/agent-turn-classifier'
import { selectedFilePath, useEditorStore } from './editor-store'

export interface AgentTurn {
  id: string
  role: AgentTurnRole
  content?: string
  filePath?: string
  kind?: AgentTurnKind
  preview?: string
  parentTurnId?: string | null
  toolTrace?: string[]
  createdAt: number
}

export interface AgentSession {
  id: string
  name: string
  summary?: string
  turns: AgentTurn[]
  createdAt: number
  updatedAt: number
  claudeSessionId?: string
  allowEdits: boolean
  collapsed: boolean
}

interface PersistedAgentState {
  sessions: AgentSession[]
  selectedSessionId: string | null
}

interface AgentStore {
  sessions: AgentSession[]
  promptDrafts: Record<string, string>
  selectedSessionId: string | null
  runningSessionId: string | null
  streamingText: string
  toolTrace: string[]
  error: string | null
  loadedVaultKey: string | null
  hydrate: (vaultPath: string | null) => Promise<void>
  createSession: (vaultPath: string | null) => void
  deleteSession: (vaultPath: string | null, sessionId: string) => Promise<void>
  deleteTurnPair: (vaultPath: string | null, sessionId: string, userTurnId: string) => Promise<void>
  clearSession: (vaultPath: string | null, sessionId: string) => Promise<void>
  selectSession: (sessionId: string) => void
  toggleSessionCollapsed: (vaultPath: string | null, sessionId: string) => void
  setAllowEdits: (vaultPath: string | null, sessionId: string, allowEdits: boolean) => void
  updatePromptDraft: (sessionId: string, promptDraft: string) => void
  sendPrompt: (vaultPath: string | null, sessionId: string) => void
  cancelPrompt: (sessionId: string) => void
  handleEvent: (vaultPath: string | null, payload: AgentEventPayload) => Promise<void>
}

const STORAGE_PREFIX_V4 = 'axonize.agent.sessions.v4'
const STORAGE_PREFIX_V3 = 'axonize.agent.sessions.v3'
const STORAGE_PREFIX_V2 = 'axonize.agent.sessions.v2'
const SESSION_NAME_MAX_CHARS = 52
const PROMPT_SNIPPET_MAX_CHARS = 240
const TOOL_TRACE_MAX = 20
const TOOL_ERROR_PREVIEW_MAX_CHARS = 120
const TOOL_INPUT_VALUE_MAX_CHARS = 80
const EMPTY_ASSISTANT_RESPONSE = '(empty response)'
const SESSION_SUMMARY_PREVIEW_MAX_CHARS = 600

function storageKeyV4(vaultPath: string | null): string {
  return `${STORAGE_PREFIX_V4}:${vaultPath ?? '__global__'}`
}

function storageKeyV3(vaultPath: string | null): string {
  return `${STORAGE_PREFIX_V3}:${vaultPath ?? '__global__'}`
}

function storageKeyV2(vaultPath: string | null): string {
  return `${STORAGE_PREFIX_V2}:${vaultPath ?? '__global__'}`
}

function activeFilePathForAgent(vaultPath: string | null): string | undefined {
  if (!vaultPath) return undefined
  const selectedFile = selectedFilePath(useEditorStore.getState().selection)
  if (!selectedFile) return undefined

  const normalizedVaultPath = vaultPath.endsWith('/') ? vaultPath.slice(0, -1) : vaultPath
  const vaultPrefix = `${normalizedVaultPath}/`
  if (selectedFile.startsWith(vaultPrefix)) {
    return selectedFile.slice(vaultPrefix.length)
  }
  if (selectedFile.startsWith('/')) return undefined
  return selectedFile
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
    (turn) => turn.role === AgentTurnRole.User && (turn.content ?? '').trim().length > 0
  )
  if (firstUserTurn?.content) {
    return summarizeUserPrompt(firstUserTurn.content, SESSION_NAME_MAX_CHARS) || `Session ${fallbackIndex}`
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

function lastUserPromptOf(session: AgentSession): string {
  for (let i = session.turns.length - 1; i >= 0; i--) {
    const turn = session.turns[i]
    if (turn.role === AgentTurnRole.User && turn.content) return turn.content
  }
  return ''
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
  messages?: LegacyAgentMessage[]
  turns?: AgentTurn[]
  createdAt: number
  updatedAt: number
  claudeSessionId?: string
  allowEdits?: boolean
}

function migrateLegacyMessage(message: LegacyAgentMessage): AgentTurn {
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
  return {
    id: message.id,
    role: AgentTurnRole.Assistant,
    content: message.content,
    kind: classifyTurn(message.content),
    preview: makePreview(message.content),
    parentTurnId: null,
    toolTrace: message.toolTrace,
    createdAt: message.createdAt
  }
}

function migrateLegacySession(session: LegacyAgentSession): AgentSession {
  const legacyMessages = session.messages ?? []
  const legacyTurns = session.turns ?? []
  const turns: AgentTurn[] = legacyMessages.length > 0
    ? legacyMessages.map(migrateLegacyMessage)
    : legacyTurns
  return {
    id: session.id,
    name: session.name,
    turns,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    claudeSessionId: session.claudeSessionId,
    allowEdits: session.allowEdits ?? false,
    collapsed: false
  }
}

async function migrateTurn(vaultPath: string, session: AgentSession, turn: AgentTurn): Promise<AgentTurn> {
  if (turn.role !== AgentTurnRole.Assistant || !turn.content || turn.filePath) return turn
  const meta = await window.axonize.agentHistory.save(vaultPath, {
    sessionId: session.id,
    turnId: turn.id,
    role: AgentTurnRole.Assistant,
    prompt: clip(lastUserPromptUpTo(session, turn), PROMPT_SNIPPET_MAX_CHARS),
    answer: turn.content,
    toolTrace: turn.toolTrace
  })
  return { ...turn, content: undefined, filePath: meta.filePath }
}

async function backfillAssistantFiles(vaultPath: string | null, sessions: AgentSession[]): Promise<AgentSession[]> {
  if (!vaultPath) return sessions
  return Promise.all(sessions.map(async (session) => {
    const turns = await Promise.all(session.turns.map((turn) => migrateTurn(vaultPath, session, turn)))
    return { ...session, turns }
  }))
}

function lastUserPromptUpTo(session: AgentSession, target: AgentTurn): string {
  const idx = session.turns.findIndex((t) => t.id === target.id)
  for (let i = idx - 1; i >= 0; i--) {
    const turn = session.turns[i]
    if (turn.role === AgentTurnRole.User && turn.content) return turn.content
  }
  return ''
}

function readPersistedRaw<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function readV4(vaultPath: string | null): PersistedAgentState | null {
  const parsed = readPersistedRaw<PersistedAgentState>(storageKeyV4(vaultPath))
  if (!parsed || !Array.isArray(parsed.sessions)) return null
  return {
    sessions: normalizeSessions(parsed.sessions),
    selectedSessionId: parsed.selectedSessionId ?? null
  }
}

function readV3Raw(vaultPath: string | null): PersistedAgentState | null {
  const parsed = readPersistedRaw<PersistedAgentState>(storageKeyV3(vaultPath))
  if (!parsed || !Array.isArray(parsed.sessions)) return null
  return {
    sessions: normalizeSessions(parsed.sessions),
    selectedSessionId: parsed.selectedSessionId ?? null
  }
}

function readV2Raw(vaultPath: string | null): PersistedAgentState | null {
  const parsed = readPersistedRaw<{ sessions?: LegacyAgentSession[]; selectedSessionId?: string | null }>(
    storageKeyV2(vaultPath)
  )
  if (!parsed || !Array.isArray(parsed.sessions)) return null
  return {
    sessions: normalizeSessions(parsed.sessions.map(migrateLegacySession)),
    selectedSessionId: parsed.selectedSessionId ?? null
  }
}

async function loadAndMigrate(vaultPath: string | null): Promise<PersistedAgentState | null> {
  const v4 = readV4(vaultPath)
  if (v4) return v4

  const legacy = readV3Raw(vaultPath) ?? readV2Raw(vaultPath)
  if (!legacy) return null

  const sessions = await backfillAssistantFiles(vaultPath, legacy.sessions)
  const migrated: PersistedAgentState = { sessions, selectedSessionId: legacy.selectedSessionId }
  persist(vaultPath, migrated)
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(storageKeyV3(vaultPath))
    window.localStorage.removeItem(storageKeyV2(vaultPath))
  }
  return migrated
}

function persist(vaultPath: string | null, state: PersistedAgentState): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(storageKeyV4(vaultPath), JSON.stringify(state))
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
  if (event.type === AgentEventKind.ToolUse) {
    const input = event.input && typeof event.input === 'object' ? summarizeInput(event.input as Record<string, unknown>) : ''
    return `▸ ${event.toolName}${input ? ` ${input}` : ''}`
  }
  if (event.type === AgentEventKind.ToolResult && event.isError) {
    const preview = event.result.slice(0, TOOL_ERROR_PREVIEW_MAX_CHARS).replace(/\s+/g, ' ')
    return `✗ ${preview}`
  }
  return null
}

const TOOL_INPUT_SUMMARY_KEYS = ['path', 'file_path', 'pattern', 'question', 'command'] as const

function summarizeInput(input: Record<string, unknown>): string {
  for (const key of TOOL_INPUT_SUMMARY_KEYS) {
    const value = input[key]
    if (typeof value === 'string' && value.length > 0) {
      return `${key}=${value.slice(0, TOOL_INPUT_VALUE_MAX_CHARS)}`
    }
  }
  return ''
}

async function deleteHistoryDirIgnoreMissing(vaultPath: string | null, sessionId: string): Promise<void> {
  if (!vaultPath) return
  try {
    await window.axonize.agentHistory.deleteSession(vaultPath, sessionId)
  } catch {
    // session dir may not exist yet for sessions with no assistant turns
  }
}

function buildInMemoryErrorTurn(content: string, toolTrace: string[]): AgentTurn {
  return {
    id: crypto.randomUUID(),
    role: AgentTurnRole.Assistant,
    content,
    kind: classifyTurn(content),
    preview: makePreview(content),
    parentTurnId: null,
    toolTrace: toolTrace.length > 0 ? [...toolTrace] : undefined,
    createdAt: Date.now()
  }
}

export const useAgentStore = create<AgentStore>((set, get) => {
  const appendTurn = (sessionId: string, turn: AgentTurn): AgentSession[] => {
    return updateSession(get().sessions, sessionId, (item) => ({
      ...item,
      turns: [...item.turns, turn],
      updatedAt: Date.now()
    }))
  }

  const handleSessionEvent = (vaultPath: string | null, sessionId: string, claudeSessionId: string): void => {
    const sessions = updateSession(get().sessions, sessionId, (item) => ({
      ...item,
      claudeSessionId,
      updatedAt: Date.now()
    }))
    set({ sessions })
    persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
  }

  const handleTextDelta = (text: string): void => {
    set({ streamingText: get().streamingText + text })
  }

  const handleToolEvent = (event: AgentEventBody): void => {
    const trace = formatToolTrace(event)
    if (trace) {
      set({ toolTrace: [...get().toolTrace, trace].slice(-TOOL_TRACE_MAX) })
    }
  }

  const handleErrorEvent = (vaultPath: string | null, sessionId: string, message: string): void => {
    const turn = buildInMemoryErrorTurn(`Agent error: ${message}`, get().toolTrace)
    const sessions = appendTurn(sessionId, turn)
    set({ sessions, error: message, streamingText: '', toolTrace: [] })
    persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
  }

  const buildSavedTurn = (meta: AgentTurnMeta, finalText: string, toolTrace: string[] | undefined): AgentTurn => ({
    id: meta.turnId,
    role: AgentTurnRole.Assistant,
    kind: classifyTurn(finalText),
    preview: makePreview(finalText),
    parentTurnId: null,
    toolTrace,
    createdAt: new Date(meta.createdAt).getTime(),
    filePath: meta.filePath
  })

  const refineSessionSummary = (
    vaultPath: string | null,
    sessionId: string,
    userPrompt: string,
    assistantPreview: string
  ): void => {
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) return
    const prevTitle = session.summary ?? session.name

    void window.axonize.llm
      .summarizeSession({
        prevTitle,
        userPrompt,
        assistantPreview: assistantPreview.slice(0, SESSION_SUMMARY_PREVIEW_MAX_CHARS)
      })
      .then((summary) => {
        const trimmed = summary.trim()
        if (!trimmed) return
        const current = get().sessions.find((s) => s.id === sessionId)
        if (!current || current.summary === trimmed) return
        const sessions = updateSession(get().sessions, sessionId, (s) => ({ ...s, summary: trimmed }))
        set({ sessions })
        persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e)
        console.warn('Session title refinement failed:', message)
      })
  }

  const handleDoneEvent = async (vaultPath: string | null, sessionId: string): Promise<void> => {
    const finalText = get().streamingText.trim() || EMPTY_ASSISTANT_RESPONSE
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) return

    const toolTrace = get().toolTrace.length > 0 ? [...get().toolTrace] : undefined

    if (!vaultPath) {
      set({ error: 'Cannot save agent response: no vault open.', streamingText: '', toolTrace: [] })
      return
    }

    try {
      const userPrompt = lastUserPromptOf(session)
      const meta = await window.axonize.agentHistory.save(vaultPath, {
        sessionId,
        turnId: crypto.randomUUID(),
        role: AgentTurnRole.Assistant,
        prompt: clip(userPrompt, PROMPT_SNIPPET_MAX_CHARS),
        answer: finalText,
        toolTrace
      })
      const sessions = appendTurn(sessionId, buildSavedTurn(meta, finalText, toolTrace))
      set({ sessions, streamingText: '', toolTrace: [] })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
      refineSessionSummary(vaultPath, sessionId, userPrompt, finalText)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ error: `Failed to save agent response: ${message}`, streamingText: '', toolTrace: [] })
    }
  }

  return {
    sessions: [],
    promptDrafts: {},
    selectedSessionId: null,
    runningSessionId: null,
    streamingText: '',
    toolTrace: [],
    error: null,
    loadedVaultKey: null,

    hydrate: async (vaultPath) => {
      const key = storageKeyV4(vaultPath)
      if (get().loadedVaultKey === key) return

      try {
        const persisted = await loadAndMigrate(vaultPath)
        const sessions = persisted?.sessions?.length
          ? persisted.sessions
          : [emptySession(1)]
        const selectedSessionId = ensureSelection(sessions, persisted?.selectedSessionId ?? null)
        set({
          sessions,
          promptDrafts: {},
          selectedSessionId,
          runningSessionId: null,
          streamingText: '',
          toolTrace: [],
          error: null,
          loadedVaultKey: key
        })
        persist(vaultPath, { sessions, selectedSessionId })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        set({ error: `Failed to migrate agent sessions: ${message}` })
      }
    },

    createSession: (vaultPath) => {
      const current = get().sessions
      const nextSession = emptySession(current.length + 1)
      const sessions = normalizeSessions([nextSession, ...current])
      const selectedSessionId = nextSession.id
      set({ sessions, selectedSessionId, error: null })
      persist(vaultPath, { sessions, selectedSessionId })
    },

    deleteSession: async (vaultPath, sessionId) => {
      const sessions = normalizeSessions(get().sessions.filter((s) => s.id !== sessionId))
      const currentSelected = get().selectedSessionId
      const selectedSessionId = ensureSelection(sessions, currentSelected === sessionId ? null : currentSelected)
      set({ sessions, selectedSessionId, error: null })
      persist(vaultPath, { sessions, selectedSessionId })
      await deleteHistoryDirIgnoreMissing(vaultPath, sessionId)
    },

    deleteTurnPair: async (vaultPath, sessionId, userTurnId) => {
      const session = get().sessions.find((s) => s.id === sessionId)
      if (!session) return
      const startIdx = session.turns.findIndex((t) => t.id === userTurnId)
      if (startIdx < 0 || session.turns[startIdx].role !== AgentTurnRole.User) return

      const idsToDelete: string[] = [userTurnId]
      for (let i = startIdx + 1; i < session.turns.length; i++) {
        if (session.turns[i].role === AgentTurnRole.User) break
        idsToDelete.push(session.turns[i].id)
      }
      const idSet = new Set(idsToDelete)

      const sessions = updateSession(get().sessions, sessionId, (s) => ({
        ...s,
        turns: s.turns.filter((t) => !idSet.has(t.id)),
        updatedAt: Date.now()
      }))
      set({ sessions, error: null })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })

      if (vaultPath) {
        try {
          await window.axonize.agentHistory.deleteTurns(vaultPath, sessionId, idsToDelete)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.warn('Failed to delete agent turn files:', message)
        }
      }
    },

    clearSession: async (vaultPath, sessionId) => {
      const wasRunning = get().runningSessionId === sessionId
      if (wasRunning) window.axonize.agent.cancel(sessionId)

      const sessions = updateSession(get().sessions, sessionId, (session) => ({
        ...session,
        turns: [],
        claudeSessionId: undefined,
        updatedAt: Date.now()
      }))
      const nextDrafts = { ...get().promptDrafts }
      delete nextDrafts[sessionId]

      set({
        sessions,
        promptDrafts: nextDrafts,
        error: null,
        ...(wasRunning ? { runningSessionId: null, streamingText: '', toolTrace: [] } : {})
      })
      persist(vaultPath, { sessions, selectedSessionId: get().selectedSessionId })
      await deleteHistoryDirIgnoreMissing(vaultPath, sessionId)
    },

    selectSession: (sessionId) => {
      set({ selectedSessionId: sessionId, error: null })
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
      const state = get()
      if (state.promptDrafts[sessionId] === promptDraft && state.error === null) return
      set({ promptDrafts: { ...state.promptDrafts, [sessionId]: promptDraft }, error: null })
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
        activeFilePath: activeFilePathForAgent(vaultPath),
        claudeSessionId: session.claudeSessionId
      })
    },

    cancelPrompt: (sessionId) => {
      window.axonize.agent.cancel(sessionId)
    },

    handleEvent: async (vaultPath, payload) => {
      const { sessionId, event } = payload
      if (get().runningSessionId !== sessionId) return

      if (event.type === AgentEventKind.Session) return handleSessionEvent(vaultPath, sessionId, event.claudeSessionId)
      if (event.type === AgentEventKind.TextDelta) return handleTextDelta(event.text)
      if (event.type === AgentEventKind.ToolUse || event.type === AgentEventKind.ToolResult) return handleToolEvent(event)
      if (event.type === AgentEventKind.Error) return handleErrorEvent(vaultPath, sessionId, event.error)
      if (event.type === AgentEventKind.Done) return handleDoneEvent(vaultPath, sessionId)
      if (event.type === AgentEventKind.Closed) {
        set({ runningSessionId: null })
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
