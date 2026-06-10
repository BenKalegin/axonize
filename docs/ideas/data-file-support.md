# Data File Support (csv / json / jsonl): Implementation Plan

Goal: view (later edit) data files in the vault, and let the agent query them properly.
Strategy: build a main-process **data-file-service** first — a windowed, session-based data
access layer. Viewers (UI) and agent MCP tools are two thin consumers of the same service.
No "virtual markdown" translation; data never goes through the markdown pipeline.

```
                ┌─ renderer viewers (CsvFileView / JsonFileView / JsonlFileView)
data-file-service ┤      via data:* IPC, windowed rows
 (main process) └─ agent MCP tools (data_schema / data_query / data_aggregate)
                       via direct service calls, capped output
```

---

## Phase 0 — Vault recognizes data files

Today the scanner, watcher, and recently-modified list are `.md`-only.

1. **`src/core/vault/data-file-types.ts`** (new, pure):
   ```ts
   export const DataFileKind = { Csv: 'csv', Json: 'json', Jsonl: 'jsonl' } as const
   export type DataFileKind = (typeof DataFileKind)[keyof typeof DataFileKind]

   const DATA_FILE_EXTENSIONS: Record<string, DataFileKind> = {
     '.csv': DataFileKind.Csv, '.json': DataFileKind.Json, '.jsonl': DataFileKind.Jsonl
   }
   export function dataFileKindOf(path: string): DataFileKind | null
   export function isVaultVisibleFile(name: string): boolean   // .md or data file
   ```
2. **`src/main/file-service.ts`** — replace both `entry.name.endsWith('.md')` checks
   (`scanDirectory` ~:111, `collectModifiedFiles` ~:57) with `isVaultVisibleFile`.
3. **`src/main/file-watcher.ts:21`** — replace `isMarkdown` with `isVaultVisibleFile`
   so edits to data files trigger `vault:filesChanged`.
4. **RAG indexing stays md-only** — `getMarkdownFiles` (`src/core/vault/file-tree.ts:15`)
   is untouched; data files must not reach the embedding pipeline.
5. File explorer: verify non-md entries render fine (icon by extension; nice-to-have).

Deliverable: data files appear in the tree; clicking one shows the existing fallback
(MarkdownView will mangle it — acceptable until Phase 3, or gate selection until then).

---

## Phase 1 — data-file-service (the substrate)

New domain **`src/main/data/`** + pure logic in **`src/core/data/`**.

### Pure core (`src/core/data/`) — unit-testable, no Node APIs

| File | Responsibility |
|---|---|
| `csv-parser.ts` | Minimal RFC 4180 tokenizer (quoted fields, quoted newlines, escaped quotes). Own parser — no papaparse dep. Exposes `indexCsvRows(buf): RowIndex` + `parseCsvRow(buf, span): string[]` |
| `jsonl-index.ts` | Newline offset index over a Buffer/Uint8Array → `RowIndex` (array of `{start, end}` spans); per-row lazy `JSON.parse` |
| `schema-inference.ts` | Sample first `SCHEMA_SAMPLE_ROWS = 200` records → `DataSchema`: union of shallow keys, per-key type (`string\|number\|boolean\|null\|object\|array\|mixed`), example value |
| `row-query.ts` | Structured predicate evaluator: `RowFilter = { field, op, value }[]`, ops `eq\|neq\|contains\|gt\|lt\|exists`; projection (`select: string[]`); pure `evaluateFilter(record, filter): boolean` |
| `types.ts` | `DataSessionInfo { sessionId, kind, shape: 'table'\|'tree', rowCount, byteSize, schema }`, `DataRow`, `JsonNodeSummary { key, type, scalarValue?, childCount? }` |

### Main service (`src/main/data/`)

| File | Responsibility |
|---|---|
| `data-file-service.ts` | Session manager keyed by **absolute path** (no sessionIds — `open` is idempotent, every call stats the file and transparently rebuilds on mtime/size change): `open(filePath) → DataSessionInfo`, `rows(filePath, offset, limit)`, `node(filePath, path, offset, limit)` (JSON tree children), `search(filePath, text)`, `query(filePath, filters, select, offset, limit)`, `close(filePath)`. LRU eviction (`MAX_OPEN_SESSIONS = 4`) |
| `row-sources.ts` | `interface RowSource` (DIP) + three impls keyed by `DataFileKind` (data-driven map, no if/else chain): csv & jsonl = Buffer + span index + lazy parse; json = full `JSON.parse`, tree-shaped (root array also exposed as table when elements are objects) |
| `data-ipc-handlers.ts` | `registerDataIpcHandlers()` → channels `data:open`, `data:rows`, `data:node`, `data:search`, `data:query`, `data:close` |

Memory model v1: whole file as one **string in main** (never shipped to the renderer),
spans parsed on demand. Guard: `MAX_DATA_FILE_BYTES = 256 MB` (V8 strings cap near
512MB chars; stay well under) → error, no fallback. fd-based windowed reads are a
later swap behind `RowSource` if ever needed.

Search: linear streaming scan over rows in main (string `includes` per row, optional
field restriction), capped at `MAX_SEARCH_RESULTS = 1000` indexes. Renderer gets indexes,
not rows — it fetches windows around them.

### Wiring

- `src/main/ipc-handlers.ts` — add `registerDataIpcHandlers()` next to the others (~:197).
- `src/preload/index.ts` — add `data: { open, rows, node, search, query, close }` to
  `window.axonize` and the `AxonizeAPI` type.
- Close all sessions on vault close / window close.

### Tests (`tests/unit/core/data/`)

- csv-parser: quoted newlines, escaped quotes, ragged rows, BOM, CRLF.
- jsonl-index: offsets across chunk boundaries, trailing newline, blank lines, bad JSON row → row-level error value (not a crash).
- schema-inference: mixed types, nested objects (shallow keys only), sample smaller than file.
- row-query: each op, missing fields, type coercion rules (none — strict types).

Deliverable: service fully usable from devtools (`window.axonize.data.open(...)`) before any UI exists.

---

## Phase 2 — Agent MCP tools (the reason for service-first)

New **`src/main/agent/data-mcp-server.ts`** following `rag-mcp-server.ts` pattern
(`createSdkMcpServer` + `tool()` + zod). Separate server `axonize-data` (SRP; rag server untouched).

| Tool | Input | Output |
|---|---|---|
| `data_schema` | `{ path }` (vault-relative) | rowCount, byteSize, key→type map, one example record |
| `data_query` | `{ path, filter?, select?, offset?, limit? }` | matching records as JSONL text + total match count |
| `data_aggregate` | `{ path, op: 'count'\|'min'\|'max'\|'sum', field?, groupBy?, filter? }` | aggregate result table |

Hard caps (named constants in the server file): `MAX_AGENT_RESULT_ROWS = 50`,
`MAX_AGENT_CELL_CHARS = 200`, `MAX_AGENT_GROUPS = 100` — a careless query can never
flood the agent's context. Paths resolved via `join(vaultPath, path)` + containment
check (reject escapes) — same posture as `query-service.ts:41`.

Wiring:
- `claude-code-npm-agent.ts` — add server to `mcpServers` alongside the RAG server.
- `claude-tool-config.ts` — add the three `mcp__axonize-data__*` tool IDs to the base
  allowed list (they are read-only); extend `defaultSystemPrompt()`:
  > "The vault may contain data files (.csv/.json/.jsonl). Use data_schema to inspect
  > structure and data_query / data_aggregate to filter, project, and aggregate records.
  > Do not Read large data files directly; Grep is fine for quick text matches."
- TTY fallback agent: **deferred** — the generated stdio bridge (`rag-mcp-bridge.ts`) and
  `rag-http-server.ts` are single-tool; the TTY transport has rag_query but no data tools
  until they are bridged the same way. The NPM (in-process) transport — the default — has
  all three.

Deliverable: agent answers "how many records in evals.jsonl have score < 0.5, grouped
by model?" without Bash/jq and without flooding context. Eval with 2–3 such prompts.

---

## Phase 3 — Viewers (renderer)

### Dispatch
`ContentView.tsx:177` — replace the growing ternary with a data-driven map
(OCP): `Record<extension, ComponentType>` → `.bpmn`, `.csv`, `.json`, `.jsonl`,
default `MarkdownView`.

### Shared pieces
- **Dep**: add `@tanstack/react-virtual` (headless, small; serves both grid and tree).
- **`src/renderer/lib/data-source.ts`** — renderer `RowSource` interface +
  `IpcRowSource` (calls `window.axonize.data.*`, window cache of
  `ROW_WINDOW_SIZE = 200` rows around the viewport).
- **`components/Content/data/DataGridView.tsx`** — virtualized read-only grid:
  columns from session schema, sticky header, search box → `data:search` →
  next/prev match navigation + row highlight, row-count/size status line.

### Per-type views (`components/Content/`)
- `CsvFileView` — `DataGridView` over a csv session.
- `JsonlFileView` — `DataGridView` (columns = inferred schema keys) + click-row →
  expandable JSON tree of that record.
- `JsonFileView` — virtualized collapsible tree: flatten *expanded* nodes into a list,
  virtualize the list; children fetched lazily via `data:node`; collapsed below depth 2
  by default; search auto-expands ancestor paths of matches.

Read-only in this phase. `SpreadsheetEditor` is **not** modified; when editing arrives,
extract its cell-edit/keyboard-nav core into a shared grid module used by both the GFM
modal and `DataGridView` (separate refactor).

Deliverable: open/scroll/search a 1M-row jsonl smoothly; demo files live in
`docs/ideas/` test data or a scratch vault inside the repo.

---

## Phase 4 (later) — RAG schema cards for discoverability

At RAG index time, emit one synthetic chunk per data file: path, rowCount, schema
summary, 1–2 sample values. `rag_query` then *routes* the agent to the right data file;
`data_query` does the querying. Do **not** embed raw records. Requires a RAG index
version bump (check the rag indexing-service version gate; `SEMANTIC_VERSION` is not
affected).

## Phase 5 (later) — Editing

`data:updateRow(sessionId, index, record)` → main rewrites the file atomically
(temp + rename), session re-indexes. Grid gains cell editing via the extracted
SpreadsheetEditor core. JSON tree editing only if a real need appears.

---

## Order & gates

| Step | Scope | Gate |
|---|---|---|
| 0 | vault filters | data files visible in tree; watcher fires on them |
| 1 | core/data + main/data + IPC + preload | unit tests green; devtools smoke test on a 1M-row jsonl |
| 2 | MCP tools + prompt | agent eval: schema/filter/aggregate prompts answered correctly |
| 3 | viewers | open/scroll/search large files; `pnpm typecheck && pnpm lint && pnpm test` |

Risks: CSV quoted-newline indexing is the only nontrivial parser (state machine + tests);
JSON files have no windowing story by nature — the size guard + lazy tree is the answer,
not streaming JSON parsing (out of scope).
