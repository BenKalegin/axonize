export interface Block {
  id: string
  type: 'document' | 'heading' | 'paragraph' | 'list' | 'code' | 'blockquote'
  depth: number
  content: string
  headingPath: string[]
  filePath: string
  startLine: number
  endLine: number
  children: Block[]
}

export interface ParsedDocument {
  filePath: string
  blocks: Block[]
  frontmatter?: Record<string, unknown>
}
