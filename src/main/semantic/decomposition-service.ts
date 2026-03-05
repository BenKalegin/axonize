import { readFile, writeFile, mkdir, rename } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import { hashContent } from '../../core/integrity/file-hasher'
import { readVaultFiles } from '../file-service'
import { getMarkdownFiles } from '../../core/vault/file-tree'
import { getSettings } from '../settings-service'
import type {
  SemanticCard,
  CardRelation,
  SemanticIndexState,
  SemanticProgress,
  SemanticEstimate
} from '../../core/semantic/types'
import { CardKind } from '../../core/semantic/types'
import { llmCompleteWithRetry, sanitizeJSON, tryParseJSON } from './llm-helpers'
import { discoverDimensions, extractFacets } from './facet-extraction-service'
import { generateClusters, generateHubNodes, generateCuratedCrossDocRelations } from './cluster-hub-service'
import { embedAndCacheSummaries } from './summary-embeddings'
import type { DimensionMeta } from '../../core/semantic/types'
import log from '../logger'

export const SEMANTIC_VERSION = 3
const INTER_DOC_DELAY = 1500
const PROMPT_OVERHEAD_TOKENS = 250
const AVG_OUTPUT_TOKENS_PER_FILE = 1500
const CROSS_DOC_OUTPUT_TOKENS = 500
const FACET_CLUSTER_OUTPUT_TOKENS = 3000
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

interface SemanticErrorPayload {
  file: string
  phase: string
  message: string
  timestamp: number
}

function sendError(window: BrowserWindow | null, error: Omit<SemanticErrorPayload, 'timestamp'>): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send('semantic:error', { ...error, timestamp: Date.now() })
  }
}

function clearErrors(window: BrowserWindow | null): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send('semantic:errors-clear')
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

function assignCardKinds(cards: SemanticCard[]): void {
  for (const card of cards) {
    if (card.kind) continue
    if (card.level === 0) card.kind = CardKind.Doc
    else if (card.level === 1) card.kind = CardKind.Section
    else if (card.level === 2) card.kind = CardKind.Detail
    else card.kind = CardKind.Chunk
  }
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

// --- LLM Decomposition ---

interface DecompositionResult {
  cards: SemanticCard[]
  relations: CardRelation[]
}

function buildDecomposePrompt(content: string, filePath: string): string {
  return `Given the following markdown document, create a multi-level semantic decomposition.

Level 0: One card — full document summary. Title: the document's actual topic. Summary: 3-5 sentences.
Level 1: 3-7 cards — major sections/themes. Title + 3-5 sentence summary.
Level 2: For each Level 1 card, sub-sections if content warrants deeper breakdown. Title + 3-5 sentence summary. Stop if a section covers 1 paragraph or less.
Level 3: Individual content chunks — paragraphs, diagrams, tables, code blocks. Only for substantive Level 2 sections with >2 paragraphs. Title: what this chunk is about. Summary: 3-5 sentences describing the content. Precise startLine/endLine.

For each card provide:
- id: a unique string (use format "card-<index>")
- title: a descriptive name for this card (NOT generic like "Document Summary" or "Overview" — use the document's actual topic)
- summary: 3-5 sentences
- level: 0, 1, 2, or 3
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

// --- JSON Parsing ---

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

// --- Document decomposition ---

async function decomposeDocument(filePath: string, content: string): Promise<DecompositionResult> {
  const prompt = buildDecomposePrompt(content, filePath)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])
  return parseDecompositionJSON(responseContent, filePath)
}

// --- Saving ---

async function saveSemanticCache(
  vaultPath: string,
  fileHashes: Record<string, string>,
  cards: SemanticCard[],
  relations: CardRelation[],
  dimensions: DimensionMeta[]
): Promise<void> {
  const dir = await ensureSemanticDir(vaultPath)
  const state: SemanticIndexState = { version: SEMANTIC_VERSION, fileHashes, dimensions }
  await atomicWriteJSON(join(dir, 'index-state.json'), state)
  await atomicWriteJSON(join(dir, 'cards.json'), cards)
  await atomicWriteJSON(join(dir, 'relations.json'), relations)
}

// --- Public API ---

async function runFacetAndClusterPhases(
  allCards: SemanticCard[],
  allRelations: CardRelation[],
  window: BrowserWindow | null
): Promise<DimensionMeta[]> {
  const level0 = allCards.filter((c) => c.level === 0)
  assignCardKinds(allCards)

  // Phase: dimension discovery
  let dimensions: DimensionMeta[] = []
  sendProgress(window, { phase: 'discovering-dimensions', current: 0, total: 1 })
  try {
    dimensions = await discoverDimensions(level0)
    log.info(`[semantic] Discovered ${dimensions.length} dimensions: ${dimensions.map((d) => d.key).join(', ')}`)
  } catch (err) {
    log.error('Dimension discovery failed:', err)
    sendError(window, { file: '(vault)', phase: 'dimension-discovery', message: String(err) })
  }

  // Phase: facet extraction
  sendProgress(window, { phase: 'facet-extraction', current: 0, total: 1 })
  try {
    const facetMap = await extractFacets(level0, dimensions)
    for (const card of level0) {
      const facet = facetMap.get(card.id)
      if (facet) card.facets = facet
    }
    log.info(`[semantic] Facets extracted for ${facetMap.size} docs`)
  } catch (err) {
    log.error('Facet extraction failed:', err)
    sendError(window, { file: '(vault)', phase: 'facet-extraction', message: String(err) })
  }

  // Phase: clustering + hubs
  sendProgress(window, { phase: 'clustering', current: 0, total: 1 })
  try {
    const facetMap = new Map(level0.filter((c) => c.facets).map((c) => [c.id, c.facets!]))
    const clusters = await generateClusters(level0, facetMap)
    const { hubs, hubRelations } = generateHubNodes(level0, facetMap, dimensions)
    allCards.push(...clusters, ...hubs)
    allRelations.push(...hubRelations)
    log.info(`[semantic] Generated ${clusters.length} clusters, ${hubs.length} hubs`)
  } catch (err) {
    log.error('Cluster/hub generation failed:', err)
    sendError(window, { file: '(vault)', phase: 'clustering', message: String(err) })
  }

  // Phase: curated cross-doc relations
  sendProgress(window, { phase: 'cross-linking', current: 0, total: 1 })
  try {
    const facetMap = new Map(level0.filter((c) => c.facets).map((c) => [c.id, c.facets!]))
    const crossRelations = await generateCuratedCrossDocRelations(level0, facetMap, dimensions)
    allRelations.push(...crossRelations)
    log.info(`[semantic] Generated ${crossRelations.length} curated cross-doc relations`)
  } catch (err) {
    log.error('Curated cross-doc relation extraction failed:', err)
    sendError(window, { file: '(vault)', phase: 'cross-linking', message: String(err) })
  }

  return dimensions
}

export async function buildSemanticIndex(
  vaultPath: string,
  window: BrowserWindow | null
): Promise<{ cardCount: number }> {
  clearErrors(window)
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
      sendError(window, { file: file.relativePath, phase: 'decomposition', message: String(err) })
    }

    if (i < mdFiles.length - 1) {
      await delay(INTER_DOC_DELAY)
    }
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

  const dimensions = await runFacetAndClusterPhases(allCards, allRelations, window)

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })
  await saveSemanticCache(vaultPath, fileHashes, allCards, allRelations, dimensions)

  sendProgress(window, { phase: 'embedding-summaries', current: 0, total: allCards.length })
  try {
    await embedAndCacheSummaries(vaultPath, allCards)
  } catch (err) {
    log.error('[semantic] Summary embedding failed:', err)
    sendError(window, { file: '(vault)', phase: 'embedding-summaries', message: String(err) })
  }

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
  if (!existingState || existingCards.length === 0 || existingState.version < SEMANTIC_VERSION) {
    return buildSemanticIndex(vaultPath, window)
  }

  clearErrors(window)
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

  for (const file of mdFiles) {
    const content = await readFile(file.path, 'utf-8')
    const hash = hashContent(content)
    currentHashes[file.relativePath] = hash
    removedFiles.delete(file.relativePath)

    const hashChanged = existingState.fileHashes[file.relativePath] !== hash
    if (hashChanged) {
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
      sendError(window, { file: relPath, phase: 'decomposition', message: String(err) })
    }

    if (i < changedFiles.length - 1) {
      await delay(INTER_DOC_DELAY)
    }
  }

  // Keep only per-file doc cards (remove old cluster/hub cards)
  const keptDocCards = keptCards.filter((c) => !c.kind || c.kind === CardKind.Doc || c.kind === CardKind.Section || c.kind === CardKind.Detail || c.kind === CardKind.Chunk)
  const allCards = [...keptDocCards, ...newCards]
  // Keep only intra-file relations, re-derive cross-doc + cluster + hub
  const allRelations = [...keptRelations, ...newRelations].filter((r) => {
    const srcCard = allCards.find((c) => c.id === r.sourceId)
    const tgtCard = allCards.find((c) => c.id === r.targetId)
    return srcCard && tgtCard && srcCard.filePath === tgtCard.filePath
  })

  const dimensions = await runFacetAndClusterPhases(allCards, allRelations, window)

  sendProgress(window, { phase: 'saving', current: 0, total: 1 })
  await saveSemanticCache(vaultPath, currentHashes, allCards, allRelations, dimensions)

  sendProgress(window, { phase: 'embedding-summaries', current: 0, total: allCards.length })
  try {
    await embedAndCacheSummaries(vaultPath, allCards)
  } catch (err) {
    log.error('[semantic] Summary embedding failed:', err)
    sendError(window, { file: '(vault)', phase: 'embedding-summaries', message: String(err) })
  }

  sendProgress(window, { phase: 'done', current: allCards.length, total: allCards.length })
  return { cardCount: allCards.length }
}

export async function loadSemanticIndex(
  vaultPath: string
): Promise<{ cards: SemanticCard[]; relations: CardRelation[]; dimensions: DimensionMeta[] }> {
  const cards = await loadCards(vaultPath)
  const relations = await loadRelations(vaultPath)
  const state = await loadSemanticState(vaultPath)
  const dimensions = state?.dimensions ?? []
  return { cards, relations, dimensions }
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
  const outputTokens = filesToProcess * AVG_OUTPUT_TOKENS_PER_FILE + CROSS_DOC_OUTPUT_TOKENS + FACET_CLUSTER_OUTPUT_TOKENS
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
