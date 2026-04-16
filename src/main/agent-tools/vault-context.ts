import { readdir, stat } from 'fs/promises'
import { join, basename, relative } from 'path'
import log from '../logger'

/**
 * Vault context provider for smart context assembly
 * Based on Claude Code's context management patterns
 */

export interface VaultInfo {
  name: string
  path: string
  fileCount: number
}

export interface RecentFile {
  relativePath: string
  mtime: Date
  size: number
}

/**
 * Count markdown files in vault (recursively)
 */
async function countMarkdownFiles(
  dirPath: string,
  maxDepth = 10,
  currentDepth = 0
): Promise<number> {
  if (currentDepth >= maxDepth) {
    return 0
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    let count = 0

    for (const entry of entries) {
      // Skip hidden and excluded directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        count += await countMarkdownFiles(fullPath, maxDepth, currentDepth + 1)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++
      }
    }

    return count
  } catch (error) {
    log.warn(`Failed to count files in ${dirPath}:`, error)
    return 0
  }
}

/**
 * Get recently modified files
 */
async function getRecentlyModifiedFiles(
  dirPath: string,
  limit: number,
  rootPath = dirPath,
  maxDepth = 10,
  currentDepth = 0
): Promise<RecentFile[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const files: RecentFile[] = []

    for (const entry of entries) {
      // Skip hidden and excluded directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await getRecentlyModifiedFiles(
          fullPath,
          limit,
          rootPath,
          maxDepth,
          currentDepth + 1
        )
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stats = await stat(fullPath)
          files.push({
            relativePath: relative(rootPath, fullPath),
            mtime: stats.mtime,
            size: stats.size
          })
        } catch (error) {
          // Skip files we can't stat
        }
      }
    }

    // Sort by modification time (newest first) and limit
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return files.slice(0, limit)
  } catch (error) {
    log.warn(`Failed to get recent files from ${dirPath}:`, error)
    return []
  }
}

/**
 * Get vault information
 */
export async function getVaultInfo(vaultPath: string): Promise<VaultInfo> {
  const name = basename(vaultPath)
  const fileCount = await countMarkdownFiles(vaultPath)

  return {
    name,
    path: vaultPath,
    fileCount
  }
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}

/**
 * Get comprehensive vault context for agent
 */
export async function getVaultContext(vaultPath: string): Promise<string> {
  const info = await getVaultInfo(vaultPath)
  const recentFiles = await getRecentlyModifiedFiles(vaultPath, 10)

  let context = `# Vault Context

**Location**: ${vaultPath}
**Name**: ${info.name}
**Files**: ${info.fileCount} markdown files

`

  if (recentFiles.length > 0) {
    context += `## Recently Modified Files\n`
    for (const file of recentFiles) {
      context += `- ${file.relativePath} (${formatRelativeTime(file.mtime)})\n`
    }
    context += `\n`
  }

  context += `## Available Tools

You have access to these tools for exploring the vault:

1. **glob** - Find files by pattern
   - Example: \`glob(pattern: "**/*eval*.md")\` to find files with "eval" in name
   - Example: \`glob(pattern: "docs/**/*.json")\` for JSON files in docs/

2. **grep** - Search file contents
   - Example: \`grep(pattern: "AQT.*benchmark", output_mode: "content")\` for content matches
   - Example: \`grep(pattern: "metrics", glob: "*.md")\` to search only markdown files

3. **read_file** - Read file contents
   - Example: \`read_file(path: "docs/evaluation.md")\` to read full file
   - Example: \`read_file(path: "large.md", line_start: 100, line_end: 200)\` for range

## Workflow Recommendations

1. **Finding Files**: Start with \`grep\` if you know content keywords, or \`glob\` if you know filename patterns
2. **Exploring Content**: Use \`grep\` with \`output_mode: "content"\` to see matching lines with context
3. **Reading Details**: Once you find relevant files, use \`read_file\` to get full content
4. **Iterative Search**: Refine your searches based on what you find

Remember: All file paths are relative to the vault root.
`

  return context
}

/**
 * Get minimal vault context (for when full context is too verbose)
 */
export async function getMinimalVaultContext(vaultPath: string): Promise<string> {
  const info = await getVaultInfo(vaultPath)

  return `Vault: ${info.name} (${info.fileCount} files at ${vaultPath})

Tools available: glob, grep, read_file
Use these tools to explore and find relevant files.`
}
