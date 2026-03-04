export const RelationType = {
  Sequence: 'sequence',
  Elaboration: 'elaboration',
  Inference: 'inference',
  Contrast: 'contrast',
  Example: 'example',
  Dependency: 'dependency'
} as const
export type RelationType = (typeof RelationType)[keyof typeof RelationType]

export const CrossDocRelationType = {
  CompetesWith: 'competes_with',
  Implements: 'implements',
  Specifies: 'specifies',
  Extends: 'extends',
  Uses: 'uses'
} as const
export type CrossDocRelationType = (typeof CrossDocRelationType)[keyof typeof CrossDocRelationType]

export const CardKind = {
  Doc: 'doc',
  Section: 'section',
  Detail: 'detail',
  Cluster: 'cluster',
  Hub: 'hub'
} as const
export type CardKind = (typeof CardKind)[keyof typeof CardKind]

/** Dynamic facets: keys are LLM-discovered dimension names, values are tag arrays */
export type Facet = Record<string, string[]>

export interface DimensionMeta {
  key: string
  label: string
  description: string
}

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
  kind?: CardKind
  facets?: Facet
  /** For hub nodes: the dimension key this hub belongs to */
  hubCategory?: string
  clusterDocIds?: string[]
}

export interface CardRelation {
  sourceId: string
  targetId: string
  type: RelationType | CrossDocRelationType | string
  label?: string
}

export interface SemanticIndexState {
  version: number
  fileHashes: Record<string, string>
  dimensions?: DimensionMeta[]
}

export interface SemanticProgress {
  phase: 'scanning' | 'decomposing' | 'discovering-dimensions' | 'facet-extraction' | 'clustering' | 'cross-linking' | 'saving' | 'done'
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
