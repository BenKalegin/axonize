import {
  stripMermaidFrontmatter,
  splitMermaidFrontmatter
} from '@core/markdown/mermaid-frontmatter'
import {
  type MermaidRenderer,
  getMermaidRenderer,
  setMermaidRenderer
} from '@core/markdown/mermaid-renderer-flag'

export { stripMermaidFrontmatter }

const MERMAID_START_RE =
  /^\s*(?:---\s*\n[\s\S]*?\n---\s*\n)?(?:architecture|block-beta|classDiagram|erDiagram|flowchart|gantt|gitGraph|graph|journey|mindmap|pie|quadrantChart|requirementDiagram|sequenceDiagram|stateDiagram|stateDiagram-v2|timeline|xychart-beta)\b/i

export function isMermaidRenderSource(source: string, className = ''): boolean {
  return /\blanguage-mermaid\b/i.test(className) || MERMAID_START_RE.test(source)
}

export function prepareMermaidSourceForRender(source: string): string {
  const normalized = source.replace(/\r\n/g, '\n')
  const parts = splitMermaidFrontmatter(normalized)
  if (!parts) return normalized

  const frontmatter = removeTopLevelYamlBlock(
    removeTopLevelYamlBlock(
      removeTopLevelYamlBlock(parts.frontmatter, 'x-axonize'),
      'config'
    ),
    'renderer'
  ).trim()
  if (!frontmatter) return parts.body.trimStart()

  return `---\n${frontmatter}\n---\n${parts.body.trimStart()}`
}

export function extractMermaidCodeFence(markdown: string): string | null {
  const match = markdown.match(/^\s*```mermaid[^\n]*\n([\s\S]*?)\n```\s*$/i)
  return match?.[1] ?? null
}

interface MermaidFenceParts {
  before: string
  source: string
  after: string
}

function splitMermaidFence(markdown: string): MermaidFenceParts | null {
  const match = markdown.match(/^(\s*```mermaid[^\n]*\n)([\s\S]*?)(\n```\s*)$/i)
  if (!match) return null
  return { before: match[1], source: match[2], after: match[3] }
}

export function getMermaidRendererFromMarkdown(markdown: string): MermaidRenderer {
  const fence = splitMermaidFence(markdown)
  return getMermaidRenderer(fence?.source ?? markdown)
}

export function setMermaidRendererInMarkdown(markdown: string, renderer: MermaidRenderer): string {
  const fence = splitMermaidFence(markdown)
  if (!fence) return setMermaidRenderer(markdown, renderer)
  const nextSource = setMermaidRenderer(fence.source, renderer)
  return `${fence.before}${nextSource}${fence.after}`
}

function removeTopLevelYamlBlock(frontmatter: string, key: string): string {
  const lines = frontmatter.split('\n')
  const keyPattern = new RegExp(`^${escapeRegExp(key)}:\\s*`)

  for (let index = 0; index < lines.length; index++) {
    if (!keyPattern.test(lines[index])) continue

    let end = index + 1
    while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) {
      end++
    }
    lines.splice(index, end - index)
    index--
  }

  return lines.join('\n')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
