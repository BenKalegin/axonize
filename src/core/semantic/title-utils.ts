const GENERIC_TITLES = new Set([
  'document summary',
  'summary',
  'overview',
  'document overview'
])

const GENERIC_SUFFIXES = [' overview', ' summary']

export function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.toLowerCase().trim())
}

function stripGenericSuffix(title: string): string {
  const lower = title.toLowerCase()
  for (const suffix of GENERIC_SUFFIXES) {
    if (lower.endsWith(suffix) && title.length > suffix.length) {
      return title.slice(0, -suffix.length).trim()
    }
  }
  return title
}

export function humanizeFilename(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath
  const stem = basename.replace(/\.md$/i, '')
  return stem
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim()
}

export function resolveCardTitle(title: string, filePath: string, level: number): string {
  if (level !== 0) return title
  if (isGenericTitle(title)) return humanizeFilename(filePath)
  return stripGenericSuffix(title)
}
