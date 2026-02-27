export const RelationType = {
  Sequence: 'sequence',
  Elaboration: 'elaboration',
  Inference: 'inference',
  Contrast: 'contrast',
  Example: 'example',
  Dependency: 'dependency'
} as const
export type RelationType = (typeof RelationType)[keyof typeof RelationType]

export interface SemanticCard {
  id: string
  filePath: string
  level: number
  parentId: string | null
  title: string
  summary: string
  childIds: string[]
  startLine: number
  endLine: number
}

export interface CardRelation {
  sourceId: string
  targetId: string
  type: RelationType
  label?: string
}

export interface SemanticIndexState {
  version: number
  fileHashes: Record<string, string>
}

export interface SemanticProgress {
  phase: 'scanning' | 'decomposing' | 'cross-linking' | 'saving' | 'done'
  current: number
  total: number
  file?: string
}

export interface SemanticEstimate {
  fileCount: number
  totalChars: number
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  cachedFiles: number
  filesToProcess: number
}
