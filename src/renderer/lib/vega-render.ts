import {
  importVegaLiteChart,
  renderChartSvg,
  defaultDarkTheme,
  defaultLightTheme,
  type ThemeTokens,
} from '@benkalegin/doodles-api'

/**
 * Render a Vega-Lite spec (JSON string) to inline SVG. Parses + maps the spec
 * to a doodles ChartSpec via doodles-vega, then renders via doodles-svg.
 * Returns SVG markup ready for dangerouslySetInnerHTML.
 *
 * Only the Vega-Lite subset doodles-vega supports is handled (single-view
 * bar/line/point/area with x/y encodings); the importer throws on anything
 * outside it, which the caller surfaces as a render error.
 */

interface CacheEntry {
  svg: string
  dark: boolean
}

const cache = new Map<string, CacheEntry>()
const MAX_CACHE_ENTRIES = 64

/**
 * Render a Vega-Lite JSON spec, caching by source-content + dark-mode key so
 * the parse + map + render only runs once per (source, theme) pair. Evicted
 * FIFO-ish at MAX_CACHE_ENTRIES.
 */
export function renderVegaLiteAsSvg(source: string, options: { dark?: boolean } = {}): string {
  const dark = options.dark === true
  const cacheKey = cacheKeyFor(source, dark)
  const cached = cache.get(cacheKey)
  if (cached) return cached.svg

  const theme: ThemeTokens = dark ? defaultDarkTheme : defaultLightTheme
  const spec = importVegaLiteChart(source)
  const svg = renderChartSvg(spec, { theme })

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(cacheKey, { svg, dark })
  return svg
}

function cacheKeyFor(source: string, dark: boolean): string {
  const len = source.length
  const head = source.slice(0, 64)
  const tail = source.slice(Math.max(0, len - 64))
  return `${dark ? 'd' : 'l'}|${len}|${head}|${tail}`
}

/**
 * Cheap heuristic to confirm the source looks like a Vega-Lite spec before
 * invoking the parser, so obviously-non-Vega fenced content short-circuits
 * with a clear message instead of a JSON/validation throw.
 */
export function looksLikeVegaLite(source: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return false
  }
  if (typeof parsed !== 'object' || parsed === null) return false
  const spec = parsed as { $schema?: unknown; mark?: unknown; encoding?: unknown }
  if (typeof spec.$schema === 'string' && spec.$schema.includes('vega-lite')) return true
  return spec.mark !== undefined && typeof spec.encoding === 'object' && spec.encoding !== null
}
