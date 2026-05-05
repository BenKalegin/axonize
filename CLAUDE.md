# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # start Electron app in dev mode (hot-reload)
pnpm build            # production build
pnpm typecheck        # run all three tsconfigs (node, web, root)
pnpm lint             # eslint src/
pnpm test             # run unit tests (vitest, single pass)
pnpm test:watch       # vitest in watch mode
pnpm test:e2e         # playwright e2e tests
```

Run a single unit test file:
```bash
pnpm vitest run tests/unit/core/markdown-parser.test.ts
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

**Agent** → `agent-store` → `window.axonize.agent.start()` → main runs `@anthropic-ai/claude-agent-sdk` with vault MCP bridge → streams `agent:event` IPC messages back to renderer.

### clouddiagram-editor (GitHub Packages)

Consumed as `@benkalegin/clouddiagram-editor` from GitHub Packages (`https://npm.pkg.github.com`). The `.npmrc` at the repo root points the `@benkalegin` scope at GHP and reads `${NODE_AUTH_TOKEN}` for auth.

**One-time auth setup** (every contributor / fresh machine):
```bash
gh auth refresh -s read:packages    # write:packages too if you publish from local
```
After that, `pnpm install` works as long as `NODE_AUTH_TOKEN` is set when running it:
```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install
```

To consume a new clouddiagram-editor version: bump the dep in `package.json` (e.g. `"@benkalegin/clouddiagram-editor": "^0.1.1"`), then run the install command above.

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
- **Never commit or push unless explicitly asked.** Wait for the user to review changes and request a commit.
- **Commit messages: one line.** Use a single concise line. Only use a second line if the change is genuinely large and one line cannot summarize it — and even then, no blank separator line and no trailers (no `Co-Authored-By`, no "Generated with..."). Keep `git log --oneline` readable.
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

## Releasing

### Cut an axonize release

CI (`.github/workflows/release.yml`) runs on `v*` tag pushes, builds Mac (arm64 dmg+zip) and Windows (installer + portable), and uploads them to a draft GitHub Release.

```bash
# 1. Bump version in package.json (e.g. 0.2.0 -> 0.2.1)
# 2. Commit, push
git add package.json && git commit -m "Bump version to X.Y.Z" && git push

# 3. Tag and push tag
git tag vX.Y.Z && git push origin vX.Y.Z

# 4. Watch CI
gh run watch $(gh run list --workflow=release.yml --limit=1 --json databaseId --jq '.[0].databaseId')

# 5. When green, publish the draft
gh release edit vX.Y.Z --draft=false
```

If a tag is already published and you need to retag (e.g. CI failed and you fixed it on `main`):
```bash
git tag -d vX.Y.Z && git push origin :vX.Y.Z      # delete locally + remotely
git tag vX.Y.Z && git push origin vX.Y.Z          # re-tag at HEAD
```

### Publish a new clouddiagram-editor version

In `../clouddiagram/`:
```bash
# 1. Bump react/package.json version (e.g. 0.1.0 -> 0.1.1)
# 2. Commit, push
git add react/package.json && git commit -m "Bump clouddiagram-editor to X.Y.Z" && git push

# 3. Tag with editor-vX.Y.Z (separate from any other tags in the repo) and push
git tag editor-vX.Y.Z && git push origin editor-vX.Y.Z

# 4. Watch the publish workflow
gh run watch $(gh run list --workflow=publish.yml --limit=1 --json databaseId --jq '.[0].databaseId')
```

Then in axonize, bump the dep version in `package.json` and run `NODE_AUTH_TOKEN=$(gh auth token) pnpm install`.

### Common pitfalls

- **`Forbidden - 403` from `npm.pkg.github.com`** — your `gh` token lacks the `read:packages` scope. Run `gh auth refresh -s read:packages`.
- **CI fails at "Install dependencies" with a missing transitive dep** — pnpm CI is strict (no hoisting). The package needs to be added as a *direct* dep in the relevant `package.json`, not just relied on as a transitive.
- **CI fails at electron-builder plist parsing with `mimeType "undefined"`** — `@xmldom/xmldom@0.9.x` regression; pin via `pnpm.overrides` to `~0.8.13`.
