import {
  applyBpmnLayout,
  importBpmnDiagram,
  renderBpmnSvg,
  defaultDarkTheme,
  defaultLightTheme,
  type ThemeTokens,
} from '@benkalegin/doodles-api'

/**
 * Render a BPMN 2.0 XML string to inline SVG. Parses the XML via doodles-bpmn,
 * runs auto-layout when BPMNDI is absent (typical for LLM-generated XML),
 * then renders via doodles-svg. Returns the SVG markup ready for
 * dangerouslySetInnerHTML.
 *
 * Renderer-process default DOM parser is used; no xmldom polyfill needed.
 */

interface CacheEntry {
  svg: string
  dark: boolean
}

const cache = new Map<string, CacheEntry>()
const MAX_CACHE_ENTRIES = 64

/**
 * Render BPMN XML, caching the result by source-content + dark-mode key so the
 * (potentially expensive) parse + layout + render only runs once per (source,
 * theme) pair. The cache is evicted FIFO-ish at MAX_CACHE_ENTRIES.
 */
export function renderBpmnXmlAsSvg(source: string, options: { dark?: boolean } = {}): string {
  const dark = options.dark === true
  const cacheKey = cacheKeyFor(source, dark)
  const cached = cache.get(cacheKey)
  if (cached) return cached.svg

  const theme: ThemeTokens = dark ? defaultDarkTheme : defaultLightTheme
  const parsed = importBpmnDiagram(source)
  const laidOut = parsed.hasLayout ? parsed : applyBpmnLayout(parsed)
  const svg = renderBpmnSvg(laidOut, {theme})

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(cacheKey, {svg, dark})
  return svg
}

function cacheKeyFor(source: string, dark: boolean): string {
  // Cheap, deterministic key — collisions only matter for cache, not correctness.
  // Source length + first/last 64 chars + dark flag is enough to disambiguate
  // typical diagram sources without hashing the whole string on every call.
  const len = source.length
  const head = source.slice(0, 64)
  const tail = source.slice(Math.max(0, len - 64))
  return `${dark ? 'd' : 'l'}|${len}|${head}|${tail}`
}

/**
 * Cheap heuristic to confirm the source looks like BPMN XML. Used as a guard
 * before invoking the parser so we can short-circuit obviously-non-BPMN
 * fenced-block content without throwing.
 */
export function looksLikeBpmnXml(source: string): boolean {
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('<')) return false
  // Accept both unprefixed <definitions> (default-namespace style) and
  // prefixed <bpmn:definitions>.
  return /<(?:[A-Za-z_][\w.-]*:)?definitions\b/.test(trimmed)
}
