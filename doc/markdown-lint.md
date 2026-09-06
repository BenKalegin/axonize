# Doc Lint

Axonize ships a built-in markdown linter that checks the currently open file for common authoring problems. Issues appear in the **Doc Lint** panel in the right sidebar, grouped by rule, with a count badge in the header.

## Where it lives

- **Rules** (pure): `src/core/markdown/lint/rules/*.ts` — each rule is `{ id, label, check, fix? }`.
- **Linter orchestration** (pure): `src/core/markdown/lint/linter.ts` — registers all rules, parses content once, runs `check` on each rule, sorts issues by line.
- **Shared types**: `src/core/markdown/lint/types.ts` — `LintIssue`, `LintRule`, `LintContext`, `LintSeverity`.
- **Helpers** (pure): `src/core/markdown/lint/utils.ts` — line lookup, single-line patching, vault-relative path, heading-slug extraction, AST walker.
- **Store** (renderer): `src/renderer/store/lint-store.ts` — orchestrates runs, debounces, prefetches linked files, hash-skips redundant runs.
- **Panel** (renderer): `src/renderer/components/Sidebar/LintPanel.tsx` — UI with per-issue and per-rule fix buttons.
- **Fixers** (renderer): `src/renderer/components/Sidebar/lint-fixers.ts` — wraps deterministic fixers and LLM rewrites.

## Rules

| ID | Label | Severity | Deterministic fix |
|---|---|---|---|
| `broken-link` | Broken links | error | — |
| `broken-image` | Broken images | error | — |
| `duplicate-heading` | Duplicate headings | info | — |
| `orphaned-footnote` | Orphaned footnotes | warning | — |
| `latex-tilde` | LaTeX tilde | warning | — |
| `mermaid-color` | Mermaid colors | warning | yes |
| `mermaid-syntax` | Mermaid syntax | error | yes |
| `trailing-html` | Trailing HTML | warning | yes |

### `broken-link`

Verifies both standard markdown links (`[text](path#anchor)`) and Obsidian-style wikilinks (`[[Target#anchor]]`).

- **File part** is resolved against the vault file set:
  - Relative paths resolve against the current file's directory.
  - Leading-slash paths (`/notes/foo.md`) resolve against the vault root.
  - Wikilinks resolve by exact path first, then by basename (first match wins on collision).
- **Anchor part** (the `#fragment`) is verified against the target file's heading slugs (GitHub-style slugs via `github-slugger`, identical to how `duplicate-heading` slugs are computed). Pure-anchor links (`#section`) check against the current file.
- External (`http://`, `https://`, `mailto:`) and unresolvable targets are handled; an unresolvable file produces a single error and the anchor is not separately checked.
- If the target file content is not available (e.g. it lives outside what the store prefetched), the anchor check is silently skipped — never a false positive.

### `broken-image`

Same resolution logic as `broken-link` but for `![alt](path)` image nodes. Vault-relative paths, leading-slash paths, and external URLs are handled.

### `duplicate-heading`

Reports info-level issues when two headings produce the same GitHub-style slug. Includes the line number of the first occurrence in the message.

### `orphaned-footnote`

Reports footnote references (`[^name]`) with no matching definition (`[^name]:`) and vice versa. Pure regex-based.

### `latex-tilde`

Flags `~text~` outside of code fences — likely a LaTeX-author mistake, since GFM uses double tildes (`~~text~~`) for strikethrough.

### `mermaid-color`

Walks fenced `mermaid` code blocks and flags raw color literals (hex codes, named colors) that should use theme tokens. Has a deterministic fixer that replaces the literal with the canonical token on the same line.

### `mermaid-syntax`

Catches common mermaid syntax mistakes inside fenced `mermaid` code blocks. Has a deterministic fixer for the patterns it recognises.

### `trailing-html`

Flags inline HTML tags (`<div>`, `<span>`, `<br>`, `<p>`, `<b>`, `<i>`, `<u>`) left over from copy-paste from rendered HTML. Has a deterministic fixer that strips the tag while preserving inner text.

## Run model

Lint runs **only on the currently selected file**. There is no whole-vault lint pass.

Triggers (both via `useLintBootstrap` in `lint-store.ts`):

1. **Editor selection change** — when the user opens a different file.
2. **`vault:filesChanged` IPC** — when anything in the vault changes (semantic-index writes, RAG writes, agent edits, on-disk file changes).

Each trigger debounces 400 ms (`DEBOUNCE_MS`) before running. The store keeps `issues: Record<filePath, LintIssue[]>` and a transient `running` flag.

### Content-hash skip

Before running rules, the store computes a cyrb53 hash of the file content and compares to the last-linted hash for that path (in-memory `Map`, per-session). If the hash matches, the run is skipped. This eliminates redundant relints when `vault:filesChanged` fires for unrelated writes (semantic index, RAG, etc.) while the open file's content is unchanged.

**Known limitation — cross-file staleness:** if file A links to a heading in file B, and B's heading is later removed without A being touched, A's cached `broken-link` results for that anchor will not update until A's own content changes. This is the explicit tradeoff against a disk-backed cache with dependency tracking; in practice users notice the staleness when they next edit A.

### Cross-file prefetch

For the anchor check in `broken-link`, the store needs read access to the heading sets of every target file referenced by the open document. Before running `lintMarkdown`, the store:

1. Calls `collectLinkedMarkdownTargets(content, currentRelPath, vaultFiles)` (in `src/core/markdown/link-targets.ts`) to get the vault-relative paths of every linked `.md` file.
2. `Promise.all`-reads them via `window.axonize.file.read`.
3. Passes a `getFileContent(rel)` lookup into the `LintContext`.

The `broken-link` rule parses each target on demand and memoises the heading-slug set within a single lint pass via an `AnchorResolver`.

## Fixers

Each `LintRule` may export an optional `fix(content, issue)` returning the patched content or `null`. Three rules ship one today: `mermaid-color`, `mermaid-syntax`, `trailing-html`.

The panel shows a wrench icon on each issue (and a group-level "fix all" button) only when a deterministic fixer is registered. A sparkle icon is always present and runs `window.axonize.llm.rewriteSection` over a 15-line context window around the issue, asking the LLM to return the corrected text only. "Fix all with AI" sends the entire document plus a numbered issue list in a single prompt.

`readFixWrite` (in `lint-fixers.ts`) ensures the file is re-read before applying a fix and triggers a re-lint via `onFixed` after writing.

## Adding a new rule

1. Create `src/core/markdown/lint/rules/<id>.ts` exporting `rule: LintRule`.
2. Register it in the `RULES` array in `linter.ts`.
3. Optionally export a `fix` function in the rule — the panel and `lint-fixers.ts` pick it up automatically.
4. Add unit tests under `tests/unit/core/lint/<id>.test.ts`.
