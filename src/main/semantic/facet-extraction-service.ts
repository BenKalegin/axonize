import type { SemanticCard, Facet, DimensionMeta } from '../../core/semantic/types'
import { llmCompleteWithRetry, sanitizeJSON, tryParseJSON } from './llm-helpers'
import log from '../logger'

// --- Dimension Discovery ---

function buildDiscoveryPrompt(level0Cards: SemanticCard[]): string {
  const docs = level0Cards
    .map((c) => `- "${c.title}": ${c.summary}`)
    .join('\n')

  return `Analyze this collection of documents and identify 3-5 cross-cutting dimensions that would be most useful for organizing and navigating them.

A "dimension" is a category of tags that many documents share. Good dimensions have values that appear across multiple documents, creating meaningful groupings.

Documents:
${docs}

For each dimension provide:
- key: a short snake_case identifier (e.g. "protocols", "regions", "techniques")
- label: a human-readable display name (e.g. "Protocols", "Regions", "Techniques")
- description: what values to extract for this dimension (1 sentence)

Output ONLY valid JSON array (no markdown fences, no explanation):
[{"key": "...", "label": "...", "description": "..."}]`
}

function parseDiscoveryResponse(raw: string): DimensionMeta[] {
  const cleaned = sanitizeJSON(raw)
  const parsed = (tryParseJSON(cleaned) ?? tryParseJSON(cleaned + ']')) as unknown[] | null
  if (!parsed || !Array.isArray(parsed)) {
    log.warn('[semantic] Could not parse dimension discovery JSON')
    return []
  }
  return parsed.map((item) => {
    const entry = item as Record<string, unknown>
    return {
      key: String(entry.key ?? 'unknown'),
      label: String(entry.label ?? entry.key ?? 'Unknown'),
      description: String(entry.description ?? '')
    }
  })
}

export async function discoverDimensions(level0Cards: SemanticCard[]): Promise<DimensionMeta[]> {
  if (level0Cards.length < 2) return []

  const prompt = buildDiscoveryPrompt(level0Cards)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])
  return parseDiscoveryResponse(responseContent)
}

// --- Facet Extraction ---

function buildFacetPrompt(level0Cards: SemanticCard[], dimensions: DimensionMeta[]): string {
  const docs = level0Cards
    .map((c) => `- id: "${c.id}" | title: "${c.title}" | summary: "${c.summary}"`)
    .join('\n')

  const dimDescriptions = dimensions
    .map((d) => `- ${d.key}: ${d.description}`)
    .join('\n')

  const dimKeys = dimensions.map((d) => `"${d.key}": [...]`).join(', ')

  return `Tag each document with short reusable labels for each dimension.

CRITICAL RULES:
- Each tag MUST be 1-2 words maximum (e.g. "MQTT", "Planning", "OCR", not "MQTT transport protocol")
- Tags MUST be reused across documents — if two docs mention the same concept, use the EXACT same tag
- Use proper nouns and standard abbreviations where possible (e.g. "ROS2" not "Robot Operating System")
- Each dimension should have a shared vocabulary of tags that appear in multiple documents
- Aim for 1-4 tags per dimension per document

Documents:
${docs}

Dimensions:
${dimDescriptions}

Also extract:
- topics: 2-3 short clustering keywords

Output ONLY valid JSON (no markdown fences, no explanation):
{
  "<doc_id>": { ${dimKeys}, "topics": [...] },
  ...
}`
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim()
  if (trimmed.length === 0) return trimmed
  if (trimmed === trimmed.toUpperCase() && trimmed.length <= 8) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function parseFacetResponse(raw: string, level0Cards: SemanticCard[], dimensions: DimensionMeta[]): Map<string, Facet> {
  const cleaned = sanitizeJSON(raw)
  const parsed = (tryParseJSON(cleaned) ?? tryParseJSON(cleaned + '}')) as Record<string, unknown> | null
  if (!parsed) {
    log.warn('[semantic] Could not parse facet extraction JSON')
    return new Map()
  }

  const allKeys = [...dimensions.map((d) => d.key), 'topics']
  const result = new Map<string, Facet>()

  for (const card of level0Cards) {
    const entry = parsed[card.id] as Record<string, unknown> | undefined
    if (!entry) continue
    const facet: Facet = {}
    for (const key of allKeys) {
      facet[key] = asStringArray(entry[key]).map(normalizeTag).filter((t) => t.length > 0)
    }
    result.set(card.id, facet)
  }
  return result
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.filter((v): v is string => typeof v === 'string')
}

export async function extractFacets(
  level0Cards: SemanticCard[],
  dimensions: DimensionMeta[]
): Promise<Map<string, Facet>> {
  if (level0Cards.length === 0 || dimensions.length === 0) return new Map()

  const prompt = buildFacetPrompt(level0Cards, dimensions)
  const responseContent = await llmCompleteWithRetry([
    { role: 'system', content: 'You are a precise document analyzer. Output only valid JSON.' },
    { role: 'user', content: prompt }
  ])
  return parseFacetResponse(responseContent, level0Cards, dimensions)
}
