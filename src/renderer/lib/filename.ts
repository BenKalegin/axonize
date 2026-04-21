const MARKDOWN_EXT = '.md'

export function sanitizeFilename(title: string, fallback = ''): string {
  const slug = title.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
  return slug || fallback
}

export function ensureMarkdownExt(filename: string): string {
  return filename.endsWith(MARKDOWN_EXT) ? filename : `${filename}${MARKDOWN_EXT}`
}
