# CLAUDE.md — Hobots

## Code Style & Architecture

- **No long methods.** Break functions longer than ~30 lines into smaller, well-named private helpers.
- **DRY.** Extract repeated logic into shared helpers immediately — never duplicate more than two lines.
- **SOLID principles:**
  - **SRP** — each file, class, and function has one responsibility.
  - **OCP** — prefer data-driven dispatch (maps, lookup tables) over if/else chains.
  - **LSP** — subtypes must be substitutable; shared interfaces like `WaitState` should be respected by all implementors.
  - **ISP** — keep interfaces small and focused (e.g. `TaskExecutorDeps`, `TaskManagerCallbacks`).
  - **DIP** — depend on abstractions (interfaces/types), not concrete implementations; inject dependencies via constructor params.
- **Abstraction.** Use interfaces, type aliases, and helper functions to hide implementation details. Prefer composition over inheritance.
- **Typecheck must pass.** Run `pnpm typecheck` after every change.
- **No fallbacks.** Never add fallback logic, backward-compatibility shims, or degraded-mode code paths. If a feature requires a capability, send the command and let it fail — do not silently fall back to an older mechanism. Services and drivers must be updated to support new commands; we do not paper over their gaps.

## Constants & Enums — Domain Co-location

- **No catch-all files.** Never create `constants.ts` or `enums.ts` barrel files that dump unrelated values together. Each constant and enum lives in the module that owns its domain concept.
- **Co-locate with the owner.** A constant used by one file belongs in that file (unexported). A constant used by several files within one service belongs in the module that defines the concept (e.g. robot physics constants live in `robotPhysics.ts`, navigation grid size lives in `navGrid.ts`).
- **Cross-service enums only in `@hobots/shared`.** Only enums genuinely imported by 2+ packages belong in `shared/src/enums.ts`. Single-package enums stay in that package (e.g. `fleetcontrol/src/enums.ts`).
- **Enum const objects over raw strings.** Always use the `const` object member (`SquadPhase.Loading`, `WaitKind.Load`, `RobotStatus.Idle`) — never the raw string literal (`"loading"`, `"load"`, `"idle"`). This enables rename-safe refactors and compile-time exhaustiveness checks.
- **Paired const + type pattern.** Every enum-like value uses `export const Foo = { ... } as const;` paired with `export type Foo = (typeof Foo)[keyof typeof Foo];`. Never use bare union string types when a named const object exists.
