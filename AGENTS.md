# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # start Electron app in dev mode (hot-reload)
pnpm build            # production build
pnpm typecheck        # run all three tsconfigs (node, web, root)
pnpm lint             # eslint src/
pnpm test             # run unit tests (vitest, single pass)
pnpm test:watch       # vitest in watch mode
pnpm test:e2e         # playwright e2e tests
pnpm test:e2e:electron # electron-targeted playwright suite
pnpm test:e2e:headed   # run electron suite in visible headed mode
pnpm test:e2e:debug    # headed mode with trace enabled
```

Run a single unit test file:
```bash
pnpm vitest run tests/unit/core/markdown-parser.test.ts
```

Install Playwright browser runtime (once per machine/user profile):
```bash
npm exec playwright install chromium
```

## Architecture

Axonize is an Electron app built with `electron-vite`. It has three processes:

- **Main** (`src/main/`) — Node.js process. Handles file I/O, vault watching, RAG indexing, semantic analysis, LLM calls, agent execution, git operations. Each domain registers IPC handlers via `registerXxxIpcHandlers()` called from `ipc-handlers.ts`.
- **Preload** (`src/preload/index.ts`) — Bridges main and renderer via `contextBridge`. Exposes `window.axonize` typed as `AxonizeAPI`. All renderer↔main communication goes through this single typed interface.
- **Renderer** (`src/renderer/`) — React + Zustand SPA. Path alias `@` maps to `src/renderer/`, `@core` maps to `src/core/`.

Shared pure logic lives in **`src/core/`** and is imported by both main and renderer (via `@core` alias). It contains: markdown parsing (`core/markdown/`), RAG types and utilities (`core/rag/`), semantic card types (`core/semantic/types.ts`), graph types, vault types, agent history types.

### Renderer layout

- `store/` — Zustand stores (`vault-store`, `editor-store`, `graph-store`, `rag-store`, etc.). Stores call `window.axonize.*` for IPC.
- `components/Content/` — main content area: `ContentView`, `MarkdownView`, `SectionBlock`, mermaid editors.
- `components/Sidebar/` — left and right panels: file explorer, agent panel, git panel, graph, semantic errors.
- `components/Graph/` — force-graph visualization.
- `lib/` — pure renderer utilities (mermaid layout, markdown rendering, section splitting, etc.).

### Key data flows

**Vault open** → `vault-store` → `window.axonize.vault.open()` → main reads files → `vault:filesChanged` pushes updates.

**Semantic index** → `semantic-ipc-handlers` → `decomposition-service` (LLM-driven, multi-pass) → stored as JSON in vault. `SEMANTIC_VERSION` in `src/main/semantic/decomposition-service.ts` gates full rebuilds.

**RAG query** → `rag-store` → main `rag-ipc-handlers` → embedding search via `@xenova/transformers` local model → LLM answer.

**Agent** → `agent-store` → `window.axonize.agent.start()` → main runs `@anthropic-ai/Codex-agent-sdk` with vault MCP bridge → streams `agent:event` IPC messages back to renderer.

### clouddiagram-editor (local package)

Sourced from `../clouddiagram/react/`. To pick up changes:
```bash
cd ../clouddiagram/react && pnpm build:lib && pnpm build:editor:types && npm pack
cd - && pnpm install
```
The `.tgz` path in `package.json` is `file:../clouddiagram/react/clouddiagram-editor-0.1.0.tgz`.

## Code Style & Architecture

- **No long methods.** Break functions longer than ~30 lines into smaller, well-named private helpers.
- **DRY.** Extract repeated logic into shared helpers immediately — never duplicate more than two lines.
- **SOLID principles:**
  - **SRP** — each file, class, and function has one responsibility.
  - **OCP** — prefer data-driven dispatch (maps, lookup tables) over if/else chains.
  - **LSP** — subtypes must be substitutable; shared interfaces should be respected by all implementors.
  - **ISP** — keep interfaces small and focused.
  - **DIP** — depend on abstractions (interfaces/types), not concrete implementations; inject dependencies via constructor params.
- **Abstraction.** Use interfaces, type aliases, and helper functions to hide implementation details. Prefer composition over inheritance.
- **Typecheck must pass.** Run `pnpm typecheck` after every change.
- **No magic numbers.** Every numeric literal (timeouts, sizes, thresholds, opacities, etc.) must be a named constant with a descriptive name. Group related constants together at the top of the file. The only exceptions are `0`, `1`, `-1`, and simple arithmetic identities.
- **No fallbacks.** Never add fallback logic, backward-compatibility shims, or degraded-mode code paths. If a feature requires a capability, send the command and let it fail — do not silently fall back to an older mechanism.

## Constants & Enums — Domain Co-location

- **No catch-all files.** Never create `constants.ts` or `enums.ts` barrel files. Each constant and enum lives in the module that owns its domain concept.
- **Co-locate with the owner.** A constant used by one file belongs in that file (unexported). A constant shared within one domain belongs in the module defining the concept.
- **Enum const objects over raw strings.** Always use the `const` object member — never the raw string literal. This enables rename-safe refactors and compile-time exhaustiveness checks.
- **Paired const + type pattern.** Every enum-like value uses `export const Foo = { ... } as const;` paired with `export type Foo = (typeof Foo)[keyof typeof Foo];`.

## Semantic Index Versioning

- **`SEMANTIC_VERSION`** in `src/main/semantic/decomposition-service.ts` controls when a full rebuild of the semantic index is required. When the vault's stored version is less than `SEMANTIC_VERSION`, the incremental update automatically triggers a full rebuild.
- **Increment `SEMANTIC_VERSION`** whenever you change the semantic schema: new `CardKind` values, new/changed decomposition prompt levels, new fields on `SemanticCard`, changes to `SemanticIndexState` shape, or changes to the summary-embedding storage format.
- Never change the decomposition algorithm or card structure without bumping the version.

## Playwright Debugging For Agents

- Use `tests/e2e/fixtures/electron-app.ts` for Electron-native automation (`_electron.launch`), not plain browser-only tests, when debugging preload/IPC issues.
- WebPreview (`http://localhost:5173`) does not include `window.axonize`; use Electron Playwright tests for features that rely on preload bridge APIs.
- Recommended debugging loop:
  1. `pnpm build`
  2. `pnpm test:e2e:electron` for CI-like run
  3. `pnpm test:e2e:headed` for visual repro
  4. `pnpm test:e2e:debug` when trace capture is needed
