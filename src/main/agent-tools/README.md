# Agent Tools System

**Based on Claude Code's proven tool architecture**

This directory contains the tool system that gives Axonize agents autonomous file exploration capabilities.

## Quick Reference

### Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `ripgrep.ts` | Fast file operations via ripgrep | `globFiles()`, `grepContent()` |
| `file-cache.ts` | Session-scoped file caching | `FileStateCache`, `sessionCacheManager` |
| `tools.ts` | Tool definitions & executors | `AGENT_TOOLS`, `executeTool()` |
| `vault-context.ts` | Smart context assembly | `getVaultContext()` |

### Tools Exported

```typescript
import { AGENT_TOOLS, executeTool, executeTools } from './tools'
import { getVaultContext } from './vault-context'
import { sessionCacheManager } from './file-cache'
import { globFiles, grepContent } from './ripgrep'
```

## Tool Definitions

### 1. Glob - File Pattern Matching

**Purpose:** Find files by glob patterns

**Input:**
```typescript
{
  pattern: string        // e.g., "**/*.md", "docs/**/*.json"
  limit?: number         // max files to return (default: 100)
  offset?: number        // pagination offset (default: 0)
}
```

**Output:**
```
Found 42 file(s):
- docs/api.md
- docs/guide.md
- README.md
...
```

**Example Usage:**
```typescript
const result = await executeTool({
  type: 'tool_use',
  id: 'tool-123',
  name: 'glob',
  input: { pattern: '**/*.md', limit: 50 }
}, vaultPath, sessionId)
```

### 2. Grep - Content Search

**Purpose:** Search file contents with regex

**Input:**
```typescript
{
  pattern: string                    // regex pattern
  glob?: string                      // file filter (e.g., "*.md")
  case_insensitive?: boolean         // ignore case (default: false)
  output_mode?: 'content' | 'files_with_matches' | 'count'
  max_count?: number                 // max matches per file (default: 50)
  context_lines?: number             // context around matches (default: 0)
}
```

**Output (files_with_matches):**
```
Found matches in 3 file(s):
- docs/api.md
- docs/guide.md
- README.md
```

**Output (content):**
```
Found 5 match(es):

docs/api.md:42
  This is the matching line with context

docs/guide.md:15
  Another matching line here
```

**Example Usage:**
```typescript
const result = await executeTool({
  type: 'tool_use',
  id: 'tool-456',
  name: 'grep',
  input: {
    pattern: 'TODO',
    glob: '*.ts',
    output_mode: 'content'
  }
}, vaultPath, sessionId)
```

### 3. Read File - File Content Reader

**Purpose:** Read file contents with line numbers

**Input:**
```typescript
{
  path: string           // relative path from vault root
  line_start?: number    // optional line range start (1-indexed)
  line_end?: number      // optional line range end (1-indexed)
}
```

**Output:**
```
     1→# Document Title
     2→
     3→This is the content of the file
     4→with line numbers in cat -n format.
     5→
     ...
```

**Example Usage:**
```typescript
const result = await executeTool({
  type: 'tool_use',
  id: 'tool-789',
  name: 'read_file',
  input: { path: 'docs/api.md' }
}, vaultPath, sessionId)
```

## Architecture Patterns

### Ripgrep Integration

```typescript
// Uses system ripgrep for performance
// Falls back to bundled binary if available
// Handles large monorepos (20MB buffer)
// Auto-excludes common directories (.git, node_modules, etc.)

const { files } = await globFiles('**/*.md', vaultPath, { limit: 100 })
```

### File Caching

```typescript
// Per-session cache with LRU eviction
// Tracks file modification time
// Automatic invalidation on changes
// Size-limited (50MB default per session)

const cache = sessionCacheManager.getCache(sessionId)
const content = await cache.get(filePath) // null if stale or missing
```

### Vault Context

```typescript
// Provides agent with vault overview:
// - File count
// - Recently modified files
// - Available tools
// - Workflow recommendations

const context = await getVaultContext(vaultPath)
// Returns formatted markdown context
```

## Performance Characteristics

| Operation | Time (typical) | Notes |
|-----------|---------------|-------|
| `globFiles()` | 50-100ms | 1000+ files |
| `grepContent()` | 100-200ms | Full text search |
| `read_file()` (cold) | 5-10ms | Disk read |
| `read_file()` (cached) | <1ms | Memory hit |

### Optimization Tips

1. **Use glob for filenames** - Faster than grep for file discovery
2. **Filter with glob parameter** - `grep(pattern, { glob: "*.md" })`
3. **Cache automatically handles** - Frequently accessed files
4. **Limit results** - Default limits prevent context overflow

## Error Handling

All tools return structured error responses:

```typescript
{
  type: 'tool_result',
  tool_use_id: 'tool-123',
  content: 'Error message here',
  is_error: true
}
```

Common errors:
- `ENOENT`: File not found
- `EACCES`: Permission denied
- `ETIMEDOUT`: Ripgrep timeout
- Pattern syntax errors

## Testing

### Unit Tests

```bash
npm run test src/main/agent-tools
```

### Manual Testing

```typescript
import { globFiles, grepContent } from './ripgrep'
import { sessionCacheManager } from './file-cache'

// Test glob
const { files } = await globFiles('**/*.md', '/path/to/vault')
console.log(`Found ${files.length} files`)

// Test grep
const { matches } = await grepContent('TODO', '/path/to/vault', {
  glob: '*.ts',
  outputMode: 'content'
})
console.log(`Found ${matches.length} matches`)

// Test cache
const cache = sessionCacheManager.getCache('test-session')
console.log(cache.getStats())
```

## Configuration

### Ripgrep Options

```typescript
// In ripgrep.ts:
const DEFAULT_MAX_BUFFER = 20 * 1024 * 1024  // 20MB
const DEFAULT_TIMEOUT = 30000                // 30s
```

### Cache Limits

```typescript
// In file-cache.ts:
const DEFAULT_MAX_CACHE_SIZE = 50 * 1024 * 1024  // 50MB per session
const MAX_CACHEABLE_FILE = 1024 * 1024          // 1MB max per file
```

### Tool Limits

```typescript
// In tools.ts:
const DEFAULT_GLOB_LIMIT = 100           // Max files per glob
const DEFAULT_GREP_MAX_COUNT = 50        // Max matches per file
const MAX_LINE_RANGE = 1000              // Max lines per read_file
```

## Integration with Agent IPC

The tools are integrated via `agent-ipc-handlers-v2.ts`:

```typescript
import { AGENT_TOOLS, executeTools } from './agent-tools/tools'

// Tools passed to LLM
const response = await llm.complete(messages, AGENT_TOOLS)

// Tool execution
if (response.stop_reason === 'tool_use') {
  const toolResults = await executeTools(toolUses, vaultPath, sessionId)
  // Continue conversation with results...
}
```

## Dependencies

- **ripgrep** (system): Fast search utility
- **Node.js fs/promises**: File operations
- **Node.js child_process**: Spawn ripgrep

No npm dependencies required for core functionality.

## Security Considerations

1. **Path Traversal Prevention** - All paths relative to vault root
2. **Directory Exclusions** - Auto-excludes .git, node_modules, etc.
3. **File Size Limits** - Large files not cached
4. **Timeout Protection** - Prevents infinite searches
5. **Error Sanitization** - Error messages don't leak system paths

## Future Enhancements

- [ ] Write tools (file_write, file_edit) with permission system
- [ ] LSP integration for code intelligence
- [ ] Tag index for frontmatter-based filtering
- [ ] Link graph for `[[wikilink]]` navigation
- [ ] Memory system (VAULT.md auto-loading)
- [ ] Semantic search integration (RAG + tools)

## See Also

- **`docs/agent-tools-integration-guide.md`** - Full integration guide
- **`docs/AGENT_TOOLS_QUICKSTART.md`** - 5-minute setup
- **`src/main/agent-ipc-handlers-v2.ts`** - IPC handler implementation
- **`src/core/rag/llm-anthropic-enhanced.ts`** - Tool-aware LLM provider

---

**Version:** 1.0.0
**Based on:** Claude Code tool architecture
**Status:** ✅ Production ready
