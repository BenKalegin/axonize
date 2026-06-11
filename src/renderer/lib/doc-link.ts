/**
 * `doc://` corpus-document links (as emitted by RAG/agent answers and eval
 * records). The link target carries the corpus document name with extra
 * decorations (e.g. `doc://TechDoc-<basename>-1-ACTIVE`), while the vault holds
 * the document as `corpus/.../<basename>.txt|.md` — so resolution is a
 * substring match over vault file basenames, not an exact lookup.
 */

const DOC_LINK_PREFIX = 'doc://'
/** Substring matches shorter than this are too ambiguous to trust. */
const MIN_MATCH_CHARS = 8
/** Preferred extensions when several files match equally (markdown renders best). */
const EXTENSION_PREFERENCE = ['.md', '.txt']

export function isDocLink(href: string): boolean {
  return href.startsWith(DOC_LINK_PREFIX)
}

/** Resolve a doc:// href to an absolute vault file path, or null when nothing matches. */
export async function resolveDocLink(href: string, vaultPath: string): Promise<string | null> {
  const target = href.slice(DOC_LINK_PREFIX.length).replace(/^\/+/, '')
  const relativePaths = await window.axonize.vault.listAllFiles(vaultPath)
  const match = matchDocTarget(target, relativePaths)
  return match ? `${vaultPath}/${match}` : null
}

/**
 * Pick the vault file whose basename best matches the target: exact basename
 * first, then the longest basename contained in the target (tolerates prefix/
 * suffix decorations), then the reverse containment. Ties break by extension
 * preference.
 */
export function matchDocTarget(target: string, relativePaths: string[]): string | null {
  const needle = target.toLowerCase()
  let best: { path: string; baseLength: number; rank: number } | null = null

  for (const path of relativePaths) {
    const base = basenameWithoutExtension(path).toLowerCase()
    if (base.length < MIN_MATCH_CHARS) continue

    const rank =
      base === needle ? 0 : needle.includes(base) ? 1 : base.includes(needle) ? 2 : -1
    if (rank === -1) continue

    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && base.length > best.baseLength) ||
      (rank === best.rank && base.length === best.baseLength && extensionRank(path) < extensionRank(best.path))
    ) {
      best = { path, baseLength: base.length, rank }
    }
  }
  return best?.path ?? null
}

/** Vault-file-looking text (e.g. `eval/15robots/run.md`) cited as plain text or inline code. */
const FILE_REFERENCE_RE = /^[\w./ -]+\.(md|markdown|txt|csv|json|jsonl|bpmn)$/i

export function looksLikeVaultFileReference(text: string): boolean {
  return FILE_REFERENCE_RE.test(text)
}

/** Resolve a textual vault file reference to an absolute path, or null. */
export async function resolveVaultFileReference(
  text: string,
  vaultPath: string
): Promise<string | null> {
  const relativePaths = await window.axonize.vault.listAllFiles(vaultPath)
  const match = matchVaultFileReference(text, relativePaths)
  return match ? `${vaultPath}/${match}` : null
}

/** Exact relative path first, then unique-enough suffix match (`/` boundary), case-insensitive fallback. */
export function matchVaultFileReference(text: string, relativePaths: string[]): string | null {
  const ref = text.trim().replace(/^\.?\//, '')
  const exact = relativePaths.find((p) => p === ref)
  if (exact) return exact

  const bySuffix = relativePaths.find((p) => p.endsWith(`/${ref}`))
  if (bySuffix) return bySuffix

  const lower = ref.toLowerCase()
  return (
    relativePaths.find((p) => p.toLowerCase() === lower || p.toLowerCase().endsWith(`/${lower}`)) ??
    null
  )
}

function basenameWithoutExtension(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

function extensionRank(path: string): number {
  const dot = path.lastIndexOf('.')
  const ext = dot === -1 ? '' : path.slice(dot).toLowerCase()
  const rank = EXTENSION_PREFERENCE.indexOf(ext)
  return rank === -1 ? EXTENSION_PREFERENCE.length : rank
}
