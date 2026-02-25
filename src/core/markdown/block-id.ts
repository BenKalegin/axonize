import { createHash } from 'crypto'

export function generateBlockId(filePath: string, headingPath: string[], content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ')
  const input = `${filePath}::${headingPath.join('/')}::${normalized}`
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
