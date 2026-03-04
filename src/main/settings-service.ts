import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import type { AppSettings } from '../core/rag/types'
import { DEFAULT_SETTINGS } from '../core/rag/types'

function settingsFilePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      llm: { ...DEFAULT_SETTINGS.llm, ...parsed.llm },
      rag: { ...DEFAULT_SETTINGS.rag, ...parsed.rag },
      ui: { ...DEFAULT_SETTINGS.ui, ...parsed.ui },
      excludedFolders: parsed.excludedFolders ?? DEFAULT_SETTINGS.excludedFolders,
      generatedDocs: { ...DEFAULT_SETTINGS.generatedDocs, ...parsed.generatedDocs }
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const filePath = settingsFilePath()
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
  const { rename } = await import('fs/promises')
  await rename(tempPath, filePath)
}
