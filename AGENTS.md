# AGENTS.md

## Purpose

This repository contains Axonize, an Electron desktop application described in `package.json` as a "Semantic Document Operating System".

The codebase is split across Electron main-process code, a React renderer, and supporting docs and scripts. Agents working here should keep changes narrow, follow existing patterns, and verify behavior with the smallest relevant checks.

## Stack

- Electron
- electron-vite
- React 19
- TypeScript
- Vitest
- Playwright
- ESLint

## Repository Map

- `src/main/`: Electron main-process code, IPC handlers, services, agent integrations
- `src/preload/`: preload bridge exposed to the renderer
- `src/renderer/`: React UI, state stores, editors, panels, and content views
- `resources/`: packaged application assets such as icons
- `scripts/`: project maintenance scripts
- `docs/`: product and architecture notes, proposals, and idea docs

## Common Commands

- `npm run dev`: start the Electron app in development
- `npm run build`: build the application
- `npm run test`: run unit tests with Vitest
- `npm run test:e2e`: run Playwright end-to-end tests
- `npm run typecheck`: run TypeScript checks across app, node, and web configs
- `npm run lint`: lint `src/`

## Working Rules

1. Read the surrounding module before editing. Match the local style instead of introducing new abstractions by default.
2. Keep main-process, preload, and renderer concerns separated. Do not bypass the preload boundary for renderer access to privileged APIs.
3. Prefer focused IPC changes: update the handler, the preload surface, and the renderer caller together when a feature crosses process boundaries.
4. Treat `docs/ideas/` as product proposals unless the current code clearly implements them already.
5. Do not revert unrelated user changes. The worktree may already be dirty.

## Change Guidance

- UI work usually belongs in `src/renderer/components/` and related stores under `src/renderer/store/`.
- Application behavior that touches filesystem, agents, git, indexing, or OS integration usually belongs in `src/main/`.
- Shared contracts should stay typed and explicit. Prefer existing TypeScript types and Zod schemas where the repo already uses them.
- For narrow changes, run the smallest useful validation first. Typical sequence: targeted inspection, then `npm run typecheck`, then the most relevant tests.

## Validation Expectations

- For TypeScript changes, run `npm run typecheck` when practical.
- For renderer or component logic, run `npm run test` if coverage exists nearby.
- For workflow or UI behavior, use `npm run dev` and `npm run test:e2e` when the change justifies it.
- If you cannot run validation, state that clearly in your handoff.

## Notes For Future Agents

- The project includes agent-related main-process code under `src/main/agent/` and renderer session UI under `src/renderer/components/Content/`.
- There are existing specialized editors and viewers, including spreadsheet, markdown, graph, HTML island, Mermaid, and data-oriented views. Reuse those patterns before adding a new editing surface.

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

**Agent** → `agent-store` → `window.axonize.agent.start()` → main runs `@anthropic-ai/claude-agent-sdk` with vault MCP bridge → streams `agent:event` IPC messages back to renderer.

### clouddiagram-editor package

The editor is provided by the published `@benkalegin/clouddiagram-editor` dependency in `package.json`.

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
  2. `pnpm exec playwright test --project=electron` for CI-like run
  3. `pnpm exec playwright test --project=electron --headed` for visual repro
  4. `pnpm exec playwright test --project=electron --headed --trace on` when trace capture is needed

