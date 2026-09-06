// "doc" / "docs" inside a project repo is conventionally the vault folder; in
// that case the user-facing name should come from the parent (the repo name).
const VAULT_DOC_FOLDER_NAMES = new Set(['doc', 'docs'])

export function vaultNameFromPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  const last = parts.at(-1) || p
  if (VAULT_DOC_FOLDER_NAMES.has(last.toLowerCase()) && parts.length >= 2) {
    return parts.at(-2)!
  }
  return last
}
