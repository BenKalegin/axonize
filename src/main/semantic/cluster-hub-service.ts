import { randomUUID } from 'crypto'
import type { SemanticCard, CardRelation, Facet, DimensionMeta } from '../../core/semantic/types'
import { CardKind } from '../../core/semantic/types'
import { llmCompleteWithRetry, sanitizeJSON, tryParseJSON } from './llm-helpers'
import log from '../logger'

// --- Clusters (LLM) ---

function buildClusterPrompt(level0Cards: SemanticCard[], facetMap: Map<string, Facet>): string {
  const docs = level0Cards
    .map((c) => {
      const f = facetMap.get(c.id)
      const topics = f?.topics?.join(', ') ?? ''
      return `- id: "${c.id}" | title: "${c.title}" | topics: [${topics}]`
    })
    .join('\n')

  return `Group these documents into 5-7 thematic clusters.

Documents:
${docs}

For each cluster provide:
- title: a short descriptive cluster name (3-5 words)
- summary: a comma-separated list of 3-5 key themes covered (e.g. "fleet coordination, task scheduling, load balancing"). Do NOT start with "This cluster" or any filler.
- docIds: array of document ids that belong to this cluster

Each document should belong to exactly one cluster. Output ONLY valid JSON (no markdown fences):
[{"title": "...", "summary": "...", "docIds": ["..."]}]`
}

interface RawCluster {
  title: string
  summary: string
  docIds: string[]
}

function stripClusterFiller(summary: string): string {
  return summary.replace(/^this cluster\s+(covers|includes|focuses on|discusses|contains)\s+/i, '').trim()
}

function parseClusterResponse(raw: string): RawCluster[] {
  const cleaned = sanitizeJSON(raw)
  const parsed = (tryParseJSON(cleaned) ?? tryParseJSON(cleaned + ']')) as unknown[] | null
  if (!parsed || !Array.isArray(parsed)) {
    log.warn('[semantic] Could not parse cluster JSON')
    return []
  }
  return parsed.map((item) => {
    const entry = item as Record<string, unknown>
    return {
      title: String(entry.title ?? 'Cluster'),
      summary: stripClusterFiller(String(entry.summary ?? '')),
      docIds: asStringArray(entry.docIds)
    }
  })
}

export async function generateClusters(
  level0Cards: SemanticCard[],
  facetMap: Map<string, Facet>
): Promise<SemanticCard[]> {
  if (level0Cards.length < 3) return []

  const prompt = buildClusterPrompt(level0Cards, facetMap)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])

  const rawClusters = parseClusterResponse(responseContent)
  const validDocIds = new Set(level0Cards.map((c) => c.id))

  return rawClusters.map((rc) => ({
    id: randomUUID(),
    filePath: '__cluster__',
    level: -1,
    parentId: null,
    title: rc.title,
    summary: rc.summary,
    childIds: [],
    startLine: 0,
    endLine: 0,
    kind: CardKind.Cluster,
    clusterDocIds: rc.docIds.filter((id) => validDocIds.has(id))
  }))
}

// --- Hub Nodes (Deterministic from dynamic dimensions) ---

const MIN_HUB_CONNECTIONS = 2

interface HubResult {
  hubs: SemanticCard[]
  hubRelations: CardRelation[]
}

export function generateHubNodes(
  level0Cards: SemanticCard[],
  facetMap: Map<string, Facet>,
  dimensions: DimensionMeta[]
): HubResult {
  const hubs: SemanticCard[] = []
  const hubRelations: CardRelation[] = []

  for (const dim of dimensions) {
    collectHubsForDimension(dim.key, dim.label, level0Cards, facetMap, hubs, hubRelations)
  }

  return { hubs, hubRelations }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function collectHubsForDimension(
  dimensionKey: string,
  dimensionLabel: string,
  level0Cards: SemanticCard[],
  facetMap: Map<string, Facet>,
  hubs: SemanticCard[],
  hubRelations: CardRelation[]
): void {
  const valueToDocIds = new Map<string, string[]>()
  const displayName = new Map<string, string>()

  for (const card of level0Cards) {
    const facet = facetMap.get(card.id)
    if (!facet) continue
    const values = facet[dimensionKey] ?? []
    for (const val of values) {
      const normalized = val.toLowerCase().trim()
      const docIds = valueToDocIds.get(normalized) ?? []
      docIds.push(card.id)
      valueToDocIds.set(normalized, docIds)
      if (!displayName.has(normalized)) displayName.set(normalized, val.trim())
    }
  }

  for (const [normalized, docIds] of valueToDocIds) {
    if (docIds.length < MIN_HUB_CONNECTIONS) continue
    const hubId = randomUUID()
    const display = titleCase(displayName.get(normalized) ?? normalized)
    hubs.push({
      id: hubId,
      filePath: '__hub__',
      level: -2,
      parentId: null,
      title: display,
      summary: `${dimensionLabel}: ${display}`,
      childIds: [],
      startLine: 0,
      endLine: 0,
      kind: CardKind.Hub,
      hubCategory: dimensionKey
    })
    for (const docId of docIds) {
      hubRelations.push({ sourceId: hubId, targetId: docId, type: 'uses' })
    }
  }
}

// --- Curated Cross-Doc Relations (LLM) ---

function buildCuratedCrossDocPrompt(level0Cards: SemanticCard[], facetMap: Map<string, Facet>, dimensions: DimensionMeta[]): string {
  const docs = level0Cards
    .map((c) => {
      const f = facetMap.get(c.id)
      const dimValues = dimensions
        .map((d) => `${d.key}: [${(f?.[d.key] ?? []).join(', ')}]`)
        .join(' | ')
      return `- id: "${c.id}" | title: "${c.title}" | summary: "${c.summary}" | ${dimValues}`
    })
    .join('\n')

  return `Given these document summaries with their facets, identify 25-35 typed semantic relations between documents.

Documents:
${docs}

Relation types:
- competes_with: documents about competing products/approaches
- implements: one document describes implementation of concepts from another
- specifies: one document specifies/details standards referenced in another
- extends: one document extends or builds upon another's concepts
- uses: one document's system uses protocols/tools described in another

For each relation provide:
- sourceId, targetId (use the document card ids above)
- type: one of "competes_with", "implements", "specifies", "extends", "uses"
- label: a short description of the relationship (5-10 words)

Output ONLY valid JSON array (no markdown fences, no explanation):
[{"sourceId": "...", "targetId": "...", "type": "...", "label": "..."}]

If fewer than 25 meaningful relations exist, output only the meaningful ones.`
}

function parseCuratedCrossDocResponse(raw: string): CardRelation[] {
  const cleaned = sanitizeJSON(raw)
  const parsed = (tryParseJSON(cleaned) ?? tryParseJSON(cleaned + ']')) as unknown[] | null
  if (!parsed || !Array.isArray(parsed)) {
    log.warn('[semantic] Could not parse curated cross-doc JSON')
    return []
  }
  return parsed.map((item) => {
    const r = item as Record<string, unknown>
    return {
      sourceId: String(r.sourceId),
      targetId: String(r.targetId),
      type: String(r.type ?? 'uses'),
      label: r.label ? String(r.label) : undefined
    }
  })
}

export async function generateCuratedCrossDocRelations(
  level0Cards: SemanticCard[],
  facetMap: Map<string, Facet>,
  dimensions: DimensionMeta[]
): Promise<CardRelation[]> {
  if (level0Cards.length < 2) return []

  const prompt = buildCuratedCrossDocPrompt(level0Cards, facetMap, dimensions)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])
  return parseCuratedCrossDocResponse(responseContent)
}

// --- Helpers ---

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.filter((v): v is string => typeof v === 'string')
}
