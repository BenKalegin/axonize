import { splitMermaidFrontmatter } from './mermaid-frontmatter'

export const MermaidRenderer = {
  Doodles: 'doodles',
  Legacy: 'legacy'
} as const
export type MermaidRenderer = (typeof MermaidRenderer)[keyof typeof MermaidRenderer]

export const DEFAULT_MERMAID_RENDERER: MermaidRenderer = MermaidRenderer.Doodles

const RENDERER_LINE_RE = /^renderer:\s*(\S+)\s*$/

export function getMermaidRenderer(source: string): MermaidRenderer {
  const parts = splitMermaidFrontmatter(source.replace(/\r\n/g, '\n'))
  if (!parts) return DEFAULT_MERMAID_RENDERER

  for (const line of parts.frontmatter.split('\n')) {
    const match = line.match(RENDERER_LINE_RE)
    if (!match) continue
    const value = match[1].toLowerCase()
    if (value === MermaidRenderer.Legacy) return MermaidRenderer.Legacy
    if (value === MermaidRenderer.Doodles) return MermaidRenderer.Doodles
  }
  return DEFAULT_MERMAID_RENDERER
}

export function setMermaidRenderer(source: string, renderer: MermaidRenderer): string {
  const normalized = source.replace(/\r\n/g, '\n')
  const parts = splitMermaidFrontmatter(normalized)
  const omit = renderer === DEFAULT_MERMAID_RENDERER

  if (!parts) {
    if (omit) return source
    return `---\nrenderer: ${renderer}\n---\n${normalized.trimStart()}`
  }

  const lines = parts.frontmatter.split('\n').filter((line) => !RENDERER_LINE_RE.test(line))
  if (!omit) lines.unshift(`renderer: ${renderer}`)

  const nextFrontmatter = lines.join('\n').trim()
  if (!nextFrontmatter) return parts.body.trimStart()
  return `---\n${nextFrontmatter}\n---\n${parts.body.trimStart()}`
}
