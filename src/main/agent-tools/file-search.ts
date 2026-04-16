import { readdir, stat, readFile } from 'fs/promises'
import { join, relative } from 'path'
import log from '../logger'

/**
 * Pure Node.js file search implementation
 * No external dependencies - works on any system with Node.js
 */

export interface GlobOptions {
  limit?: number
  offset?: number
  includeHidden?: boolean
}

export interface GrepOptions {
  glob?: string
  caseInsensitive?: boolean
  contextBefore?: number
  contextAfter?: number
  maxCount?: number
  outputMode?: 'content' | 'files_with_matches' | 'count'
}

export interface GrepMatch {
  file: string
  lineNumber?: number
  line?: string
  count?: number
}

// Directories to always exclude
const EXCLUDED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.next',
  '.cache',
  'dist',
  'build',
  'out',
  'coverage',
  '.vscode',
  '.idea'
])

/**
 * Check if a path matches a glob pattern
 * Supports **, *, and ? wildcards
 */
function matchGlob(path: string, pattern: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/')
  const normalizedPattern = pattern.replace(/\\/g, '/')
  let regexPattern = ''

  for (let i = 0; i < normalizedPattern.length; i++) {
    const char = normalizedPattern[i]
    const next = normalizedPattern[i + 1]
    const nextNext = normalizedPattern[i + 2]

    if (char === '*' && next === '*') {
      if (nextNext === '/') {
        regexPattern += '(?:.*/)?'
        i += 2
      } else {
        regexPattern += '.*'
        i += 1
      }
      continue
    }

    if (char === '*') {
      regexPattern += '[^/]*'
      continue
    }

    if (char === '?') {
      regexPattern += '[^/]'
      continue
    }

    regexPattern += /[|\\{}()[\]^$+?.]/.test(char) ? `\\${char}` : char
  }

  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(normalizedPath)
}

/**
 * Recursively walk directory tree
 */
async function* walkDirectory(
  dirPath: string,
  basePath: string,
  maxDepth = 20,
  currentDepth = 0
): AsyncGenerator<string> {
  if (currentDepth >= maxDepth) {
    return
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden files if needed
      if (entry.name.startsWith('.')) {
        continue
      }

      const fullPath = join(dirPath, entry.name)
      const relativePath = relative(basePath, fullPath)

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (EXCLUDED_DIRS.has(entry.name)) {
          continue
        }

        // Recurse into subdirectory
        yield* walkDirectory(fullPath, basePath, maxDepth, currentDepth + 1)
      } else if (entry.isFile()) {
        yield relativePath
      }
    }
  } catch (error) {
    log.warn(`Failed to read directory ${dirPath}:`, error)
  }
}

/**
 * Find files matching a glob pattern
 */
export async function globFiles(
  pattern: string,
  basePath: string,
  options: GlobOptions = {}
): Promise<{ files: string[]; truncated: boolean }> {
  const { limit = 100, offset = 0, includeHidden = false } = options

  try {
    const allFiles: string[] = []

    // Walk directory tree
    for await (const file of walkDirectory(basePath, basePath)) {
      // Apply glob pattern
      if (pattern === '**/*' || matchGlob(file, pattern)) {
        allFiles.push(file)
      }

      // Early termination if we have enough files
      if (allFiles.length >= offset + limit + 100) {
        break
      }
    }

    // Sort alphabetically
    allFiles.sort()

    // Apply offset and limit
    const files = allFiles.slice(offset, offset + limit)
    const truncated = allFiles.length > offset + limit

    return { files, truncated }
  } catch (error) {
    log.error('Glob failed:', error)
    throw error
  }
}

/**
 * Search for pattern in a single file
 */
async function searchFile(
  filePath: string,
  pattern: RegExp,
  options: {
    maxCount?: number
    contextBefore?: number
    contextAfter?: number
  }
): Promise<Array<{ lineNumber: number; line: string; context?: string[] }>> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const matches: Array<{ lineNumber: number; line: string; context?: string[] }> = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (pattern.test(line)) {
        const match: { lineNumber: number; line: string; context?: string[] } = {
          lineNumber: i + 1,
          line: line
        }

        // Add context lines if requested
        if (options.contextBefore || options.contextAfter) {
          const contextBefore = options.contextBefore || 0
          const contextAfter = options.contextAfter || 0
          const start = Math.max(0, i - contextBefore)
          const end = Math.min(lines.length, i + contextAfter + 1)
          match.context = lines.slice(start, end)
        }

        matches.push(match)

        // Check max count
        if (options.maxCount && matches.length >= options.maxCount) {
          break
        }
      }
    }

    return matches
  } catch (error) {
    // File might be binary or inaccessible
    return []
  }
}

/**
 * Search file contents using regex pattern
 */
export async function grepContent(
  patternStr: string,
  basePath: string,
  options: GrepOptions = {}
): Promise<{ matches: GrepMatch[]; truncated: boolean }> {
  const {
    glob = '**/*',
    caseInsensitive = false,
    contextBefore = 0,
    contextAfter = 0,
    maxCount = 50,
    outputMode = 'files_with_matches'
  } = options

  try {
    // Create regex pattern
    const pattern = new RegExp(patternStr, caseInsensitive ? 'i' : '')

    const results: GrepMatch[] = []
    const filesWithMatches = new Set<string>()
    const matchCounts = new Map<string, number>()

    // Walk directory and search files
    for await (const file of walkDirectory(basePath, basePath)) {
      // Apply glob filter
      if (!matchGlob(file, glob)) {
        continue
      }

      // Skip non-text files (simple heuristic)
      if (!isLikelyTextFile(file)) {
        continue
      }

      const fullPath = join(basePath, file)
      const fileMatches = await searchFile(fullPath, pattern, {
        maxCount,
        contextBefore,
        contextAfter
      })

      if (fileMatches.length > 0) {
        filesWithMatches.add(file)
        matchCounts.set(file, fileMatches.length)

        if (outputMode === 'content') {
          for (const match of fileMatches) {
            results.push({
              file,
              lineNumber: match.lineNumber,
              line: match.line
            })
          }
        }
      }
    }

    // Format output based on mode
    if (outputMode === 'files_with_matches') {
      return {
        matches: Array.from(filesWithMatches).map((file) => ({ file })),
        truncated: false
      }
    } else if (outputMode === 'count') {
      return {
        matches: Array.from(matchCounts.entries()).map(([file, count]) => ({
          file,
          count
        })),
        truncated: false
      }
    } else {
      // content mode
      return { matches: results, truncated: false }
    }
  } catch (error) {
    log.error('Grep failed:', error)
    return { matches: [], truncated: false }
  }
}

/**
 * Check if a file is likely a text file based on extension
 */
function isLikelyTextFile(filename: string): boolean {
  const textExtensions = new Set([
    '.md',
    '.markdown',
    '.txt',
    '.json',
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.css',
    '.scss',
    '.html',
    '.xml',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.conf',
    '.config',
    '.log',
    '.sh',
    '.bash',
    '.py',
    '.rb',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.go',
    '.rs',
    '.php',
    '.sql',
    '.r',
    '.R',
    '.swift',
    '.kt',
    '.scala',
    '.clj',
    '.vim',
    '.el',
    '.tex',
    '.rst',
    '.adoc',
    '.org'
  ])

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return textExtensions.has(ext)
}

/**
 * Get file statistics for sorting and caching
 */
export async function getFileStats(filePath: string): Promise<{
  mtimeMs: number
  size: number
}> {
  const stats = await stat(filePath)
  return {
    mtimeMs: stats.mtimeMs,
    size: stats.size
  }
}
