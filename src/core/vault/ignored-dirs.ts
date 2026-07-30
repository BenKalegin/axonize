export const VAULT_IGNORED_DIRS = new Set([
  '.axonize',
  '.cache',
  '.git',
  '.next',
  '.tox',
  'build',
  'coverage',
  'dist',
  'env',
  'node_modules',
  'out',
  'venv',
  '__pycache__'
])

export function isVaultIgnoredDirName(name: string): boolean {
  return name.startsWith('.') || VAULT_IGNORED_DIRS.has(name)
}

export function pathContainsVaultIgnoredDir(path: string): boolean {
  return path.split(/[\\/]/).some(isVaultIgnoredDirName)
}
