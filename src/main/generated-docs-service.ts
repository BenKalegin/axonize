import { readFile, writeFile, readdir, unlink, mkdir, rename, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { getSettings } from './settings-service'
import type { GeneratedDocMeta } from '../core/rag/types'
import log from './logger'

const GENERATED_DIR = '.axonize/generated'

function generatedDir(vaultPath: string): string {
  return join(vaultPath, GENERATED_DIR)
}

function buildFrontmatter(title: string, query: string, createdAt: string): string {
  return `---\ntitle: "${title.replace(/"/g, '\\"')}"\nquery: "${query.replace(/"/g, '\\"')}"\ncreatedAt: "${createdAt}"\n---\n\n`
}

function parseFrontmatter(content: string): { title: string; query: string; createdAt: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null

  const frontmatter = match[1]
  const body = content.slice(match[0].length)
  const title = frontmatter.match(/title:\s*"(.*)"/)?.[1] ?? ''
  const query = frontmatter.match(/query:\s*"(.*)"/)?.[1] ?? ''
  const createdAt = frontmatter.match(/createdAt:\s*"(.*)"/)?.[1] ?? ''
  return { title, query, createdAt, body }
}

export async function saveGeneratedDoc(
  vaultPath: string,
  title: string,
  query: string,
  answer: string
): Promise<GeneratedDocMeta> {
  const dir = generatedDir(vaultPath)
  await mkdir(dir, { recursive: true })

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const filePath = join(dir, `${id}.md`)
  const content = buildFrontmatter(title, query, createdAt) + answer

  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, content, 'utf-8')
  await rename(tempPath, filePath)

  return { id, title, query, createdAt, filePath }
}

export async function listGeneratedDocs(vaultPath: string): Promise<GeneratedDocMeta[]> {
  const dir = generatedDir(vaultPath)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const docs: GeneratedDocMeta[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const filePath = join(dir, entry)
    try {
      const content = await readFile(filePath, 'utf-8')
      const parsed = parseFrontmatter(content)
      if (!parsed) continue
      const id = entry.replace(/\.md$/, '')
      docs.push({ id, title: parsed.title, query: parsed.query, createdAt: parsed.createdAt, filePath })
    } catch {
      log.warn('Failed to read generated doc:', entry)
    }
  }

  docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return docs
}

export async function renameGeneratedDoc(filePath: string, newTitle: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8')
  const parsed = parseFrontmatter(content)
  if (!parsed) throw new Error('Invalid generated doc format')

  const updated = buildFrontmatter(newTitle, parsed.query, parsed.createdAt) + parsed.body
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, updated, 'utf-8')
  await rename(tempPath, filePath)
}

export async function makePermanent(filePath: string, targetPath: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8')
  const parsed = parseFrontmatter(content)
  if (!parsed) throw new Error('Invalid generated doc format')

  await mkdir(dirname(targetPath), { recursive: true })
  const tempPath = `${targetPath}.tmp`
  await writeFile(tempPath, parsed.body, 'utf-8')
  await rename(tempPath, targetPath)
  await unlink(filePath)
}

export async function deleteGeneratedDoc(filePath: string): Promise<void> {
  await unlink(filePath)
}

export async function cleanupExpiredDocs(vaultPath: string): Promise<number> {
  const settings = await getSettings()
  const retentionDays = settings.generatedDocs.retentionDays
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000

  const docs = await listGeneratedDocs(vaultPath)
  let removed = 0
  for (const doc of docs) {
    if (new Date(doc.createdAt).getTime() < cutoff) {
      try {
        await unlink(doc.filePath)
        removed++
      } catch {
        log.warn('Failed to delete expired doc:', doc.filePath)
      }
    }
  }
  if (removed > 0) {
    log.info(`Cleaned up ${removed} expired generated doc(s)`)
  }
  return removed
}

export async function listVaultFolders(vaultPath: string): Promise<string[]> {
  const folders: string[] = ['.']
  async function walk(dir: string, rel: string): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const fullPath = join(dir, entry)
      try {
        const s = await stat(fullPath)
        if (s.isDirectory()) {
          const relPath = rel ? `${rel}/${entry}` : entry
          folders.push(relPath)
          await walk(fullPath, relPath)
        }
      } catch {
        // skip inaccessible entries
      }
    }
  }
  await walk(vaultPath, '')
  return folders
}
