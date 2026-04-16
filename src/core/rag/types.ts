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
  provider: 'anthropic' | 'openai' | 'ollama' | 'claude-code' | 'codex'
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

export interface AppearanceConfig {
  themeId: string
}

export interface AppSettings {
  llm: LLMConfig
  rag: RagConfig
  ui?: UILayoutConfig
  excludedFolders: string[]
  generatedDocs: GeneratedDocsConfig
  appearance?: AppearanceConfig
}

export interface LLMTextBlock {
  type: 'text'
  text: string
}

export interface LLMToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface LLMToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type LLMContentBlock = LLMTextBlock | LLMToolUseBlock | LLMToolResultBlock
export type LLMContent = string | LLMContentBlock[]

export function llmContentToString(content: LLMContent): string {
  if (typeof content === 'string') {
    return content
  }

  return content
    .filter((block): block is LLMTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: LLMContent
}

export interface LLMResponse {
  content: string
  model: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface RAGQueryResult {
  answer: string
  suggestedTitle: string
  sources: Array<{
    filePath: string
    startLine: number
    headingPath: string[]
    score: number
    contentPreview: string
  }>
}

export interface GeneratedDocsConfig {
  retentionDays: number
}

export interface GeneratedDocSource {
  filePath: string
  startLine: number
  headingPath: string[]
  score: number
  contentPreview: string
}

export interface GeneratedDocMeta {
  id: string
  title: string
  query: string
  createdAt: string
  filePath: string
  sources: GeneratedDocSource[]
}

export interface IndexProgress {
  phase: 'scanning' | 'extracting' | 'embedding' | 'saving' | 'done'
  current: number
  total: number
  file?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: 'claude-code',
    model: 'claude-sonnet-4-6',
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
  excludedFolders: ['node_modules', '.git', '.next', 'dist', 'build', 'out', '.cache'],
  generatedDocs: {
    retentionDays: 7
  },
  appearance: {
    themeId: 'catppuccin-mocha'
  }
}
