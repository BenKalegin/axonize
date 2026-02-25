export interface EmbeddingChunk {
  id: string
  filePath: string
  headingPath: string[]
  blockType: string
  startLine: number
  endLine: number
  content: string
}

export interface ChunkMeta {
  blockId: string
  filePath: string
  headingPath: string[]
  blockType: string
  startLine: number
  endLine: number
  contentPreview: string
}

export interface SearchResult {
  meta: ChunkMeta
  score: number
  content: string
}

export interface RagIndexState {
  version: number
  modelId: string
  dimensions: number
  chunkCount: number
  fileHashes: Record<string, string>
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'ollama'
  apiKey?: string
  model: string
  maxTokens: number
  temperature: number
  baseUrl?: string
}

export interface RagConfig {
  embeddingProvider: string
  topK: number
  minScore: number
}

export interface UILayoutConfig {
  activePanelId: string | null
  sidePanelWidth: number
}

export interface AppSettings {
  llm: LLMConfig
  rag: RagConfig
  ui?: UILayoutConfig
  excludedFolders: string[]
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  model: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface RAGQueryResult {
  answer: string
  sources: Array<{
    filePath: string
    startLine: number
    headingPath: string[]
    score: number
    contentPreview: string
  }>
}

export interface IndexProgress {
  phase: 'scanning' | 'extracting' | 'embedding' | 'saving' | 'done'
  current: number
  total: number
  file?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: 'anthropic',
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    temperature: 0.3
  },
  rag: {
    embeddingProvider: 'local-minilm',
    topK: 5,
    minScore: 0.3
  },
  ui: {
    activePanelId: 'files',
    sidePanelWidth: 220
  },
  excludedFolders: []
}
