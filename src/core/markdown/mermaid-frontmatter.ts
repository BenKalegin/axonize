export function stripMermaidFrontmatter(source: string): string {
  return splitMermaidFrontmatter(source.replace(/\r\n/g, '\n'))?.body.trimStart() ?? source
}

export function splitMermaidFrontmatter(
  source: string
): { frontmatter: string; body: string } | null {
  const trimmedStart = source.trimStart()
  if (!trimmedStart.startsWith('---\n')) return null

  const closing = trimmedStart.indexOf('\n---\n', 4)
  if (closing < 0) return null

  return {
    frontmatter: trimmedStart.slice(4, closing),
    body: trimmedStart.slice(closing + 5)
  }
}
