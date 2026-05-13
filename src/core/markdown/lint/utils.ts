import type { Heading, Root } from 'mdast'
import GithubSlugger from 'github-slugger'
import { getTextContent } from '../parser'

export function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

export function extractHeadingSlugs(tree: Root): Set<string> {
  const slugger = new GithubSlugger()
  const slugs = new Set<string>()
  for (const node of tree.children) {
    if (node.type !== 'heading') continue
    slugs.add(slugger.slug(getTextContent(node as Heading)))
  }
  return slugs
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

export function normalizeMdPath(path: string): string {
  return path.replace(/\.md$/, '')
}

export function fileExists(vaultFiles: Set<string>, normalizedPath: string): boolean {
  return vaultFiles.has(normalizedPath + '.md') || vaultFiles.has(normalizedPath)
}

const basenameIndexCache = new WeakMap<Set<string>, Map<string, string>>()

export function buildMdBasenameIndex(vaultFiles: Set<string>): Map<string, string> {
  const cached = basenameIndexCache.get(vaultFiles)
  if (cached) return cached
  const byBasename = new Map<string, string>()
  for (const f of vaultFiles) {
    if (!f.endsWith('.md')) continue
    const noExt = f.replace(/\.md$/, '')
    const basename = noExt.split('/').pop()
    if (basename && !byBasename.has(basename)) byBasename.set(basename, noExt)
  }
  basenameIndexCache.set(vaultFiles, byBasename)
  return byBasename
}

export function walkNodes<T>(node: unknown, nodeType: string, visitor: (n: T) => void): void {
  const n = node as { type?: string; children?: unknown[] }
  if (n.type === nodeType) visitor(n as unknown as T)
  if (Array.isArray(n.children)) {
    for (const child of n.children) walkNodes(child, nodeType, visitor)
  }
}
