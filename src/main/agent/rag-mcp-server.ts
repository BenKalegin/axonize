import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import { executeQuery } from '../rag/query-service'
import log from '../logger'

const RAG_SERVER_NAME = 'axonize-rag'
const RAG_TOOL_NAME = 'rag_query'
const SOURCE_PREVIEW_LIMIT = 6

export async function createInProcessRagMcpServer(vaultPath: string): Promise<McpSdkServerConfigWithInstance> {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const { z } = await import('zod')

  const ragTool = tool(
    RAG_TOOL_NAME,
    'Semantic search over the vault documentation. Returns an answer synthesized from the top matching excerpts plus their file/line sources. Use for broad "what do the docs say about X" questions; use Read/Glob/Grep for precise file lookups.',
    {
      question: z.string().describe('Natural language question to search the vault for')
    },
    async ({ question }) => {
      try {
        const result = await executeQuery(vaultPath, question)
        const sourcesText = result.sources
          .slice(0, SOURCE_PREVIEW_LIMIT)
          .map((s) => `- ${s.filePath}:${s.startLine}  (score=${s.score.toFixed(3)})`)
          .join('\n')

        const payload = `Answer:\n${result.answer}\n\nSources:\n${sourcesText || '(none)'}`
        return { content: [{ type: 'text' as const, text: payload }] }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error('rag-mcp: rag_query failed:', error)
        return { content: [{ type: 'text' as const, text: `rag_query error: ${message}` }], isError: true }
      }
    }
  )

  return createSdkMcpServer({ name: RAG_SERVER_NAME, tools: [ragTool] })
}

export const RAG_MCP_SERVER_NAME = RAG_SERVER_NAME
export const RAG_MCP_TOOL_NAME = RAG_TOOL_NAME
