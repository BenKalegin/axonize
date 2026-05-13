export function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

export function patchLine(
  content: string,
  lineNumber: number,
  transform: (line: string) => string
): string | null {
  const lines = content.split('\n')
  const idx = lineNumber - 1
  if (idx < 0 || idx >= lines.length) return null
  const fixed = transform(lines[idx])
  if (fixed === lines[idx]) return null
  lines[idx] = fixed
  return lines.join('\n')
}

export function relativePathFromVault(filePath: string, vaultPath: string): string {
  return filePath.startsWith(vaultPath + '/') ? filePath.slice(vaultPath.length + 1) : filePath
}

export function resolveRelative(from: string, href: string): string {
  const parts = from.split('/')
  parts.pop()
  for (const seg of href.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

export function walkNodes<T>(node: unknown, nodeType: string, visitor: (n: T) => void): void {
  const n = node as { type?: string; children?: unknown[] }
  if (n.type === nodeType) visitor(n as unknown as T)
  if (Array.isArray(n.children)) {
    for (const child of n.children) walkNodes(child, nodeType, visitor)
  }
}
