import { writeFile, readFile, mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import log from '../logger'

/**
 * Token usage logger for semantic processing
 * Tracks which files consume how many tokens for budget planning
 */

interface FileProcessingEntry {
  timestamp: string
  file: string
  phase: 'decomposition' | 'facet' | 'cluster' | 'hub' | 'cross-doc'
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  duration?: number
}

interface WeeklyLogSummary {
  weekStart: string
  weekEnd: string
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  filesProcessed: number
  entries: FileProcessingEntry[]
}

const LOGS_DIR = join(app.getPath('userData'), 'logs', 'token-usage')
const MAX_LOG_AGE_DAYS = 30 // Keep logs for 30 days

/**
 * Get the week identifier (YYYY-WW format)
 */
function getWeekId(date: Date = new Date()): string {
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

/**
 * Get log file path for a specific week
 */
function getLogFilePath(weekId: string): string {
  return join(LOGS_DIR, `token-usage-${weekId}.json`)
}

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true })
}

/**
 * Load existing log for the current week
 */
async function loadCurrentLog(): Promise<WeeklyLogSummary | null> {
  const weekId = getWeekId()
  const filePath = getLogFilePath(weekId)

  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as WeeklyLogSummary
  } catch {
    return null
  }
}

/**
 * Get week start and end dates
 */
function getWeekBounds(weekId: string): { start: string; end: string } {
  const [yearStr, weekStr] = weekId.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)

  // Calculate start of week (Monday)
  const startOfYear = new Date(year, 0, 1)
  const daysToMonday = (8 - startOfYear.getDay()) % 7 || 7
  const firstMonday = new Date(year, 0, 1 + daysToMonday)
  const weekStart = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000)
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)

  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0]
  }
}

/**
 * Save log for the current week
 */
async function saveLog(logData: WeeklyLogSummary): Promise<void> {
  await ensureLogsDir()
  const weekId = getWeekId()
  const filePath = getLogFilePath(weekId)

  try {
    await writeFile(filePath, JSON.stringify(logData, null, 2), 'utf-8')
  } catch (error) {
    log.error('[token-logger] Failed to save log:', error)
  }
}

/**
 * Log a file processing operation
 */
export async function logFileProcessing(entry: Omit<FileProcessingEntry, 'timestamp'>): Promise<void> {
  try {
    const weekId = getWeekId()
    const bounds = getWeekBounds(weekId)
    let logData = await loadCurrentLog()

    if (!logData) {
      // Create new log for this week
      logData = {
        weekStart: bounds.start,
        weekEnd: bounds.end,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        filesProcessed: 0,
        entries: []
      }
    }

    // Add new entry
    const fullEntry: FileProcessingEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    logData.entries.push(fullEntry)
    logData.totalInputTokens += entry.inputTokens
    logData.totalOutputTokens += entry.outputTokens
    logData.totalTokens += entry.totalTokens
    logData.filesProcessed = new Set(logData.entries.map(e => e.file)).size

    await saveLog(logData)
  } catch (error) {
    log.error('[token-logger] Failed to log file processing:', error)
  }
}

/**
 * Clean up old log files
 */
export async function cleanupOldLogs(): Promise<void> {
  try {
    await ensureLogsDir()
    const files = await readdir(LOGS_DIR)
    const now = Date.now()
    const maxAge = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000

    for (const file of files) {
      if (!file.startsWith('token-usage-') || !file.endsWith('.json')) {
        continue
      }

      const filePath = join(LOGS_DIR, file)
      try {
        const content = await readFile(filePath, 'utf-8')
        const logData = JSON.parse(content) as WeeklyLogSummary
        const weekEnd = new Date(logData.weekEnd).getTime()

        if (now - weekEnd > maxAge) {
          await unlink(filePath)
          log.info(`[token-logger] Cleaned up old log: ${file}`)
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch (error) {
    log.error('[token-logger] Failed to cleanup old logs:', error)
  }
}

/**
 * Get summary for current week
 */
export async function getCurrentWeekSummary(): Promise<WeeklyLogSummary | null> {
  return loadCurrentLog()
}

/**
 * Get summary statistics
 */
export async function getTokenStatistics(): Promise<{
  weekStart: string
  weekEnd: string
  totalTokens: number
  filesProcessed: number
  topConsumers: Array<{ file: string; totalTokens: number; processCount: number }>
}> {
  const logData = await loadCurrentLog()

  if (!logData) {
    const bounds = getWeekBounds(getWeekId())
    return {
      weekStart: bounds.start,
      weekEnd: bounds.end,
      totalTokens: 0,
      filesProcessed: 0,
      topConsumers: []
    }
  }

  // Calculate top consumers
  const fileStats = new Map<string, { totalTokens: number; processCount: number }>()

  for (const entry of logData.entries) {
    const existing = fileStats.get(entry.file) || { totalTokens: 0, processCount: 0 }
    existing.totalTokens += entry.totalTokens
    existing.processCount += 1
    fileStats.set(entry.file, existing)
  }

  const topConsumers = Array.from(fileStats.entries())
    .map(([file, stats]) => ({ file, ...stats }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 20) // Top 20 consumers

  return {
    weekStart: logData.weekStart,
    weekEnd: logData.weekEnd,
    totalTokens: logData.totalTokens,
    filesProcessed: logData.filesProcessed,
    topConsumers
  }
}

/**
 * Export log as CSV for analysis
 */
export async function exportLogAsCSV(): Promise<string> {
  const logData = await loadCurrentLog()

  if (!logData || logData.entries.length === 0) {
    return 'timestamp,file,phase,inputTokens,outputTokens,totalTokens,model,duration\n'
  }

  const header = 'timestamp,file,phase,inputTokens,outputTokens,totalTokens,model,duration\n'
  const rows = logData.entries.map(entry => {
    return [
      entry.timestamp,
      `"${entry.file.replace(/"/g, '""')}"`, // Escape quotes in filenames
      entry.phase,
      entry.inputTokens,
      entry.outputTokens,
      entry.totalTokens,
      entry.model,
      entry.duration || ''
    ].join(',')
  })

  return header + rows.join('\n')
}
