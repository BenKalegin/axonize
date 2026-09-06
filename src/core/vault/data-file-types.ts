export const DataFileKind = {
  Csv: 'csv',
  Json: 'json',
  Jsonl: 'jsonl'
} as const
export type DataFileKind = (typeof DataFileKind)[keyof typeof DataFileKind]

const DATA_FILE_EXTENSIONS: Record<string, DataFileKind> = {
  '.csv': DataFileKind.Csv,
  '.json': DataFileKind.Json,
  '.jsonl': DataFileKind.Jsonl
}

/** Non-data extensions the vault should also surface (each has a dedicated viewer). */
const VIEWABLE_EXTENSIONS = new Set(['.md', '.txt', '.bpmn'])

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase()
}

export function dataFileKindOf(fileName: string): DataFileKind | null {
  return DATA_FILE_EXTENSIONS[extensionOf(fileName)] ?? null
}

export function isDataFile(fileName: string): boolean {
  return dataFileKindOf(fileName) !== null
}

/** Files the vault scanner, watcher, and explorer should surface. */
export function isVaultVisibleFile(fileName: string): boolean {
  return VIEWABLE_EXTENSIONS.has(extensionOf(fileName)) || isDataFile(fileName)
}
