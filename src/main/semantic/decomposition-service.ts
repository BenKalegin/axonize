import { readFile, writeFile, mkdir, rename } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import { hashContent } from '../../core/integrity/file-hasher'
import { readVaultFiles } from '../file-service'
import { getMarkdownFiles } from '../../core/vault/file-tree'
import { getSettings } from '../settings-service'
import { createLLMProvider } from '../../core/rag/llm-factory'
import type { LLMMessage } from '../../core/rag/types'
import type {
  SemanticCard,
  CardRelation,
  SemanticIndexState,
  SemanticProgress,
  SemanticEstimate
} from '../../core/semantic/types'
import log from '../logger'

const SEMANTIC_VERSION = 1
const SEMANTIC_MAX_TOKENS = 4096
const RETRY_DELAYS = [3000, 6000, 12000]
const INTER_DOC_DELAY = 1500
const PROMPT_OVERHEAD_TOKENS = 250
const AVG_OUTPUT_TOKENS_PER_FILE = 1500
const CROSS_DOC_OUTPUT_TOKENS = 500
const CHARS_PER_TOKEN = 4

// --- Build lock ---

let buildInProgress: Promise<{ cardCount: number }> | null = null

// --- Helpers ---

function semanticDir(vaultPath: string): string {
  return join(vaultPath, '.axonize', 'semantic')
}

async function ensureSemanticDir(vaultPath: string): Promise<string> {
  const dir = semanticDir(vaultPath)
  await mkdir(dir, { recursive: true })
  return dir
}

function sendProgress(window: BrowserWindow | null, progress: SemanticProgress): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send('semantic:progress', progress)
  }
}

function isExcluded(relativePath: string, excludedFolders: string[]): boolean {
  return excludedFolders.some(
    (folder) => relativePath === folder || relativePath.startsWith(folder + '/')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Cache I/O ---

async function atomicWriteJSON(filePath: string, data: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  await rename(tempPath, filePath)
}

export async function loadSemanticState(vaultPath: string): Promise<SemanticIndexState | null> {
  try {
    const raw = await readFile(join(semanticDir(vaultPath), 'index-state.json'), 'utf-8')
    return JSON.parse(raw) as SemanticIndexState
  } catch {
    return null
  }
}

export async function loadCards(vaultPath: string): Promise<SemanticCard[]> {
  try {
    const raw = await readFile(join(semanticDir(vaultPath), 'cards.json'), 'utf-8')
    return JSON.parse(raw) as SemanticCard[]
  } catch {
    return []
  }
}

export async function loadRelations(vaultPath: string): Promise<CardRelation[]> {
  try {
    const raw = await readFile(join(semanticDir(vaultPath), 'relations.json'), 'utf-8')
    return JSON.parse(raw) as CardRelation[]
  } catch {
    return []
  }
}

// --- LLM with retry ---

async function llmCompleteWithRetry(messages: LLMMessage[]): Promise<string> {
  const settings = await getSettings()
  const llm = createLLMProvider({ ...settings.llm, maxTokens: SEMANTIC_MAX_TOKENS })

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await llm.complete(messages)
      return response.content
    } catch (err) {
      const isRateLimit = String(err).includes('429') || String(err).includes('rate_limit')
      if (!isRateLimit || attempt >= RETRY_DELAYS.length) throw err
      const waitMs = RETRY_DELAYS[attempt]
      log.info(`[semantic] Rate limited, retrying in ${waitMs}ms...`)
      await delay(waitMs)
    }
  }
  throw new Error('Unreachable')
}

// --- LLM Decomposition ---

interface DecompositionResult {
  cards: SemanticCard[]
  relations: CardRelation[]
}

function buildDecomposePrompt(content: string, filePath: string): string {
  return `Given the following markdown document, create a multi-level semantic decomposition.

Level 0: One card — a 2-3 sentence summary of the entire document.
Level 1: 3-7 cards — major sections/themes, each with a 1-2 sentence summary.
Level 2: For each Level 1 card, 3-7 sub-cards if the content warrants deeper breakdown. Stop if a section covers 1 paragraph or less.

For each card provide:
- id: a unique string (use format "card-<index>")
- title: short heading, under 8 words
- summary: 1-3 sentences
- level: 0, 1, or 2
- parentId: the id of the parent card (null for level 0)
- childIds: array of child card ids (empty array if no children)
- startLine: approximate start line in the document (1-based)
- endLine: approximate end line in the document (1-based)

Also output relations between cards at the same level:
- sourceId, targetId (card ids)
- type: one of "sequence", "elaboration", "inference", "contrast", "example", "dependency"

Output ONLY valid JSON with this exact structure (no markdown fences, no explanation):
{"cards": [...], "relations": [...]}

File: ${filePath}

Document:
${content}`
}

function buildCrossDocPrompt(level0Cards: SemanticCard[]): string {
  const summaries = level0Cards
    .map((c) => `- id: "${c.id}" | file: "${c.filePath}" | title: "${c.title}" | summary: "${c.summary}"`)
    .join('\n')

  return `Given these document-level summaries, identify semantic relations between documents.

Documents:
${summaries}

For each relation provide:
- sourceId, targetId (use the document card ids above)
- type: one of "sequence", "elaboration", "inference", "contrast", "example", "dependency"

Output ONLY valid JSON array (no markdown fences, no explanation):
[{"sourceId": "...", "targetId": "...", "type": "..."}]

If no meaningful cross-document relations exist, output: []`
}

// --- JSON Parsing ---

function sanitizeJSON(raw: string): string {
  let s = raw.replace(/^```json?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
  s = s.replace(/,\s*([}\]])/g, '$1')
  return s
}

function tryParseJSON(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseDecompositionJSON(raw: string, filePath: string): DecompositionResult {
  const cleaned = sanitizeJSON(raw)
  const parsed = (tryParseJSON(cleaned) ?? tryParseJSON(cleaned + ']}') ?? tryParseJSON(cleaned + '}]}')) as Record<string, unknown> | null
  if (!parsed) {
    log.warn(`Could not parse decomposition JSON for ${filePath}, returning empty`)
    return { cards: [], relations: [] }
  }

  const rawCards = (parsed.cards ?? []) as Record<string, unknown>[]
  const cards: SemanticCard[] = rawCards.map((c) => ({
    id: randomUUID(),
    filePath,
    level: Number(c.level ?? 0),
    parentId: String(c.parentId ?? ''),
    title: String(c.title ?? ''),
    summary: String(c.summary ?? ''),
    childIds: (c.childIds as string[]) ?? [],
    startLine: Number(c.startLine ?? 1),
    endLine: Number(c.endLine ?? 1)
  }))

  const idMap = new Map<string, string>()
  rawCards.forEach((c, i) => { idMap.set(String(c.id), cards[i].id) })

  for (const card of cards) {
    card.parentId = card.parentId ? (idMap.get(card.parentId) ?? null) : null
    card.childIds = card.childIds
      .map((cid) => idMap.get(cid))
      .filter((cid): cid is string => cid != null)
  }

  const relations: CardRelation[] = ((parsed.relations ?? []) as Record<string, unknown>[]).map((r) => ({
    sourceId: idMap.get(String(r.sourceId)) ?? String(r.sourceId),
    targetId: idMap.get(String(r.targetId)) ?? String(r.targetId),
    type: String(r.type ?? 'sequence')
  }))

  return { cards, relations }
}

function parseCrossDocJSON(raw: string): CardRelation[] {
  const cleaned = sanitizeJSON(raw)
  const parsed = (tryParseJSON(cleaned) ?? tryParseJSON(cleaned + ']')) as unknown[] | null
  if (!parsed || !Array.isArray(parsed)) {
    log.warn('Could not parse cross-doc JSON, returning empty')
    return []
  }
  return parsed.map((r: Record<string, unknown>) => ({
    sourceId: String(r.sourceId),
    targetId: String(r.targetId),
    type: String(r.type ?? 'sequence')
  }))
}

// --- Document decomposition ---

async function decomposeDocument(filePath: string, content: string): Promise<DecompositionResult> {
  const prompt = buildDecomposePrompt(content, filePath)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])
  return parseDecompositionJSON(responseContent, filePath)
}

async function findCrossDocRelations(level0Cards: SemanticCard[]): Promise<CardRelation[]> {
  if (level0Cards.length < 2) return []

  const prompt = buildCrossDocPrompt(level0Cards)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])
  return parseCrossDocJSON(responseContent)
}

// --- Saving ---

async function saveSemanticCache(
  vaultPath: string,
  fileHashes: Record<string, string>,
  cards: SemanticCard[],
  relations: CardRelation[]
): Promise<void> {
  const dir = await ensureSemanticDir(vaultPath)
  const state: SemanticIndexState = { version: SEMANTIC_VERSION, fileHashes }
  await atomicWriteJSON(join(dir, 'index-state.json'), state)
  await atomicWriteJSON(join(dir, 'cards.json'), cards)
  await atomicWriteJSON(join(dir, 'relations.json'), relations)
}

// --- Public API ---

export async function buildSemanticIndex(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ cardCount: number }> {
  sendProgress(window, { phase: 'scanning', current: 0, total: 0 })

  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []
  const fileTree = await readVaultFiles(vaultPath)
  const mdFiles = getMarkdownFiles(fileTree).filter(
    (f) => !isExcluded(f.relativePath, excluded)
  )

  const fileHashes: Record<string, string> = {}
  const allCards: SemanticCard[] = []
  const allRelations: CardRelation[] = []

  for (let i = 0; i < mdFiles.length; i++) {
    const file = mdFiles[i]
    sendProgress(window, { phase: 'decomposing', current: i + 1, total: mdFiles.length, file: file.relativePath })
    log.info(`[semantic] Decomposing ${i + 1}/${mdFiles.length}: ${file.relativePath}`)

    const content = await readFile(file.path, 'utf-8')
    fileHashes[file.relativePath] = hashContent(content)

    try {
      const result = await decomposeDocument(file.relativePath, content)
      allCards.push(...result.cards)
      allRelations.push(...result.relations)
    } catch (err) {
      log.error(`Semantic decomposition failed for ${file.relativePath}:`, err)
    }

    if (i < mdFiles.length - 1) {
      await delay(INTER_DOC_DELAY)
    }
  }

  sendProgress(window, { phase: 'cross-linking', current: 0, total: 1 })
  try {
    const level0 = allCards.filter((c) => c.level === 0)
    const crossRelations = await findCrossDocRelations(level0)
    allRelations.push(...crossRelations)
  } catch (err) {
    log.error('Cross-document relation extraction failed:', err)
  }

  // Don't overwrite a valid cache with empty results from failed LLM calls
  if (allCards.length === 0 && mdFiles.length > 0) {
    const existing = await loadCards(vaultPath)
    if (existing.length > 0) {
      log.warn(`[semantic] All decompositions failed, keeping existing ${existing.length} cards`)
      sendProgress(window, { phase: 'done', current: existing.length, total: existing.length })
      return { cardCount: existing.length }
    }
  }

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })
  await saveSemanticCache(vaultPath, fileHashes, allCards, allRelations)

  sendProgress(window, { phase: 'done', current: allCards.length, total: allCards.length })
  log.info(`[semantic] Build complete: ${allCards.length} cards`)
  return { cardCount: allCards.length }
}

export async function incrementalSemanticUpdate(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ cardCount: number }> {
  // Serialize builds: if one is in progress, wait for it
  if (buildInProgress) {
    return buildInProgress
  }

  const promise = doIncrementalUpdate(vaultPath, window)
  buildInProgress = promise
  try {
    return await promise
  } finally {
    buildInProgress = null
  }
}

async function doIncrementalUpdate(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ cardCount: number }> {
  const existingState = await loadSemanticState(vaultPath)
  const existingCards = await loadCards(vaultPath)
  if (!existingState || existingCards.length === 0) {
    return buildSemanticIndex(vaultPath, window)
  }

  sendProgress(window, { phase: 'scanning', current: 0, total: 0 })

  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []
  const fileTree = await readVaultFiles(vaultPath)
  const mdFiles = getMarkdownFiles(fileTree).filter(
    (f) => !isExcluded(f.relativePath, excluded)
  )

  const currentHashes: Record<string, string> = {}
  const changedFiles: string[] = []
  const removedFiles = new Set<string>(Object.keys(existingState.fileHashes))
  const filesWithCards = new Set(existingCards.map((c) => c.filePath))

  for (const file of mdFiles) {
    const content = await readFile(file.path, 'utf-8')
    const hash = hashContent(content)
    currentHashes[file.relativePath] = hash
    removedFiles.delete(file.relativePath)

    const hashChanged = existingState.fileHashes[file.relativePath] !== hash
    const missingCards = !filesWithCards.has(file.relativePath)
    if (hashChanged || missingCards) {
      changedFiles.push(file.relativePath)
    }
  }

  if (changedFiles.length === 0 && removedFiles.size === 0) {
    sendProgress(window, { phase: 'done', current: existingCards.length, total: existingCards.length })
    return { cardCount: existingCards.length }
  }

  const existingRelations = await loadRelations(vaultPath)
  const changedSet = new Set([...changedFiles, ...removedFiles])

  const keptCards = existingCards.filter((c) => !changedSet.has(c.filePath))
  const keptCardIds = new Set(keptCards.map((c) => c.id))
  const keptRelations = existingRelations.filter(
    (r) => keptCardIds.has(r.sourceId) && keptCardIds.has(r.targetId)
  )

  const newCards: SemanticCard[] = []
  const newRelations: CardRelation[] = []

  for (let i = 0; i < changedFiles.length; i++) {
    const relPath = changedFiles[i]
    sendProgress(window, { phase: 'decomposing', current: i + 1, total: changedFiles.length, file: relPath })

    const fullPath = join(vaultPath, relPath)
    const content = await readFile(fullPath, 'utf-8')

    try {
      const result = await decomposeDocument(relPath, content)
      newCards.push(...result.cards)
      newRelations.push(...result.relations)
    } catch (err) {
      log.error(`Semantic decomposition failed for ${relPath}:`, err)
    }

    if (i < changedFiles.length - 1) {
      await delay(INTER_DOC_DELAY)
    }
  }

  const allCards = [...keptCards, ...newCards]
  // Keep only intra-file relations, re-derive cross-doc
  let allRelations = [...keptRelations, ...newRelations].filter((r) => {
    const srcCard = allCards.find((c) => c.id === r.sourceId)
    const tgtCard = allCards.find((c) => c.id === r.targetId)
    return srcCard && tgtCard && srcCard.filePath === tgtCard.filePath
  })

  sendProgress(window, { phase: 'cross-linking', current: 0, total: 1 })
  try {
    const level0 = allCards.filter((c) => c.level === 0)
    const crossRelations = await findCrossDocRelations(level0)
    allRelations.push(...crossRelations)
  } catch (err) {
    log.error('Cross-document relation extraction failed:', err)
  }

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })
  await saveSemanticCache(vaultPath, currentHashes, allCards, allRelations)

  sendProgress(window, { phase: 'done', current: allCards.length, total: allCards.length })
  return { cardCount: allCards.length }
}

export async function loadSemanticIndex(
  vaultPath: string
): Promise<{ cards: SemanticCard[]; relations: CardRelation[] }> {
  const cards = await loadCards(vaultPath)
  const relations = await loadRelations(vaultPath)
  return { cards, relations }
}

export async function estimateSemanticBuild(vaultPath: string): Promise<SemanticEstimate> {
  const settings = await getSettings()
  const excluded = settings.excludedFolders ?? []
  const fileTree = await readVaultFiles(vaultPath)
  const mdFiles = getMarkdownFiles(fileTree).filter(
    (f) => !isExcluded(f.relativePath, excluded)
  )

  const existingState = await loadSemanticState(vaultPath)
  const existingHashes = existingState?.fileHashes ?? {}
  const existingCards = await loadCards(vaultPath)
  const filesWithCards = new Set(existingCards.map((c) => c.filePath))

  let totalChars = 0
  let filesToProcess = 0
  let cachedFiles = 0

  for (const file of mdFiles) {
    const content = await readFile(file.path, 'utf-8')
    const hash = hashContent(content)
    const hashMatch = existingHashes[file.relativePath] === hash
    const hasCards = filesWithCards.has(file.relativePath)
    if (hashMatch && hasCards) {
      cachedFiles++
    } else {
      filesToProcess++
      totalChars += content.length
    }
  }

  const inputTokens = Math.ceil(totalChars / CHARS_PER_TOKEN) + filesToProcess * PROMPT_OVERHEAD_TOKENS
  const outputTokens = filesToProcess * AVG_OUTPUT_TOKENS_PER_FILE + CROSS_DOC_OUTPUT_TOKENS
  const costPerInputToken = estimateInputCost(settings.llm.provider, settings.llm.model)
  const costPerOutputToken = estimateOutputCost(settings.llm.provider, settings.llm.model)
  const estimatedCostUsd = (inputTokens * costPerInputToken + outputTokens * costPerOutputToken) / 1_000_000

  return {
    fileCount: mdFiles.length,
    totalChars,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    cachedFiles,
    filesToProcess
  }
}

function estimateInputCost(provider: string, model: string): number {
  if (provider === 'ollama') return 0
  if (provider === 'anthropic') return model.includes('haiku') ? 0.25 : 3.0
  // OpenAI
  if (model.includes('gpt-4o-mini')) return 0.15
  if (model.includes('gpt-4o')) return 2.5
  if (model.includes('gpt-4')) return 30.0
  return 5.0
}

function estimateOutputCost(provider: string, model: string): number {
  if (provider === 'ollama') return 0
  if (provider === 'anthropic') return model.includes('haiku') ? 1.25 : 15.0
  // OpenAI
  if (model.includes('gpt-4o-mini')) return 0.6
  if (model.includes('gpt-4o')) return 10.0
  if (model.includes('gpt-4')) return 60.0
  return 15.0
}
