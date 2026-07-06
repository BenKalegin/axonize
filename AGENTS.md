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
