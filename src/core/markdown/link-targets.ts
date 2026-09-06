import { MD_LINK_RE, WIKILINK_RE } from './link-patterns'
import {
  buildMdBasenameIndex,
  fileExists,
  normalizeMdPath,
  resolveRelative
} from './lint/utils'

export function collectLinkedMarkdownTargets(
  content: string,
  currentRelPath: string,
  vaultFiles: Set<string>
): Set<string> {
  const targets = new Set<string>()
  const basenames = buildMdBasenameIndex(vaultFiles)

  MD_LINK_RE.lastIndex = 0
  let md: RegExpExecArray | null
  while ((md = MD_LINK_RE.exec(content)) !== null) {
    const url = md[2]
    if (!url || url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('#')) continue
    const [rawPath] = url.split('#')
    if (!rawPath) continue
    const decoded = decodeURIComponent(rawPath)
    const resolved = decoded.startsWith('/')
      ? normalizeMdPath(decoded.slice(1))
      : normalizeMdPath(resolveRelative(currentRelPath, decoded))
    const candidate = resolved + '.md'
    if (vaultFiles.has(candidate)) targets.add(candidate)
  }

  WIKILINK_RE.lastIndex = 0
  let wl: RegExpExecArray | null
  while ((wl = WIKILINK_RE.exec(content)) !== null) {
    const [target] = wl[1].split('#')
    if (!target) continue
    if (fileExists(vaultFiles, target)) {
      targets.add(target.endsWith('.md') ? target : target + '.md')
      continue
    }
    const basename = target.split('/').pop() ?? target
    const resolved = basenames.get(basename)
    if (resolved) targets.add(resolved + '.md')
  }

  return targets
}
