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
    removeTopLevelYamlBlock(parts.frontmatter, 'x-axonize'),
    'config'
  ).trim()
  if (!frontmatter) return parts.body.trimStart()

  return `---\n${frontmatter}\n---\n${parts.body.trimStart()}`
}

export function stripMermaidFrontmatter(source: string): string {
  return splitMermaidFrontmatter(source.replace(/\r\n/g, '\n'))?.body.trimStart() ?? source
}

export function extractMermaidCodeFence(markdown: string): string | null {
  const match = markdown.match(/^\s*```mermaid[^\n]*\n([\s\S]*?)\n```\s*$/i)
  return match?.[1] ?? null
}

function splitMermaidFrontmatter(source: string): { frontmatter: string; body: string } | null {
  const trimmedStart = source.trimStart()
  if (!trimmedStart.startsWith('---\n')) return null

  const closing = trimmedStart.indexOf('\n---\n', 4)
  if (closing < 0) return null

  return {
    frontmatter: trimmedStart.slice(4, closing),
    body: trimmedStart.slice(closing + 5)
  }
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
