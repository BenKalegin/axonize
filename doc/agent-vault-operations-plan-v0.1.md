# Agent Over Vault Plan (v0.1)

## Goal

Enable Claude Code / Codex-configured workflows to do more than Q&A:

- read and reason over the vault
- propose and apply markdown edits
- create/rename/move/delete docs and folders
- keep RAG + semantic indexes consistent after changes

The agent must be safe, transparent, and deterministic enough for daily use.

## Current Baseline (as implemented)

- Command input currently executes query-only RAG flow.
- IPC already supports direct file primitives (`read`, `write`, `rename`, `delete`).
- File tree already supports create document, rename file, delete file from UI.
- Section-level AI rewrite exists but only inside an open section editor.
- Codex and Claude Code providers are configured in text-only/no-tools mode today.

## Product Scope for v0.1

### In scope

- Agent tasks from one command input:
  - "create ADR for X"
  - "rewrite this doc to be concise"
  - "move all billing docs to docs/payments/"
  - "rename onboarding.md to getting-started.md"
- Plan-first execution with preview + apply confirmation.
- Path-safe vault mutations.
- Automatic post-apply index sync.
- Structured agent run log (request -> plan -> apply result).

### Out of scope

- Arbitrary shell command execution by the model.
- Non-vault filesystem access.
- Concurrent multi-agent edits in one transaction.
- Binary file transformations.

## Architecture

```text
Command Input
  -> Agent Orchestrator (main process)
    -> Context Assembler (vault + optional semantic/RAG context)
    -> LLM Planner (strict JSON plan)
    -> Plan Validator (schema + policy checks)
    -> Dry-Run Diff Builder
  -> UI Preview
  -> Apply Confirmation
  -> Vault Mutation Executor
  -> Index Sync (RAG incremental + Semantic incremental)
  -> Agent Run Log
```

## Data Contracts

## 1) Agent request

```json
{
  "vaultPath": "/abs/vault",
  "userIntent": "move onboarding docs into docs/getting-started",
  "focusedFile": "docs/onboarding.md",
  "mode": "plan_only | plan_and_apply"
}
```

## 2) Planned action (LLM output, strict JSON)

```json
{
  "summary": "Short plan summary",
  "operations": [
    {
      "op": "create_file | update_file | move_path | delete_path | create_folder",
      "path": "docs/...",
      "fromPath": "docs/...",
      "content": "...",
      "instruction": "...",
      "expectedHash": "optional"
    }
  ],
  "requiresConfirmation": true,
  "warnings": []
}
```

## 3) Execution result

```json
{
  "applied": true,
  "runId": "agent-run-...",
  "changes": [
    {
      "op": "move_path",
      "path": "docs/new.md",
      "status": "ok | skipped | failed",
      "message": "..."
    }
  ],
  "reindex": {
    "rag": "ok",
    "semantic": "ok"
  }
}
```

## Safety Model

## Policies

- All paths must resolve inside current `vaultPath`.
- Default allowlist:
  - `.md` files
  - folder create/move under vault
- High-risk ops always require confirmation:
  - delete
  - overwrite existing file
  - bulk move/rename (> N files)
- Hard limits:
  - max operations per run
  - max bytes written per run

## Conflict handling

- For update operations, compare current content hash vs `expectedHash` if present.
- On mismatch, return conflict and ask user to re-plan or force.

## Execution Strategy

## Phase A: Plan only (no write)

- parse user intent
- assemble compact context
- request strict JSON plan from provider
- validate + produce preview

## Phase B: Apply (write enabled via app executor only)

- execute validated operations transactionally (best effort with rollback map)
- refresh file tree
- run:
  - `rag:indexVault` (incremental)
  - `semantic:incremental`

## Provider Strategy

Use Claude Code / Codex as planners first (JSON plan generation), not direct filesystem actors.

Why:

- same behavior across providers
- centralized policy enforcement
- predictable audit + testing

Future option:

- optional native tool-enabled provider mode behind a feature flag.

## UI Changes

- Command bar supports two intents:
  - query mode (existing)
  - agent mode (new)
- Add `Agent Run` panel:
  - summary
  - operations list
  - diff preview
  - apply/cancel buttons
  - run history

## Implementation Phases

## Milestone 1: Agent planning pipeline (no apply)

- add `agent:plan` IPC
- add orchestrator + validator
- add UI panel for plan preview
- no writes yet

Acceptance:

- entering an agent task returns a valid plan or clear validation error.

## Milestone 2: Safe apply for docs

- add mutation executor with:
  - `create_file`
  - `update_file`
  - `move_path`
  - `delete_path`
  - `create_folder`
- add apply confirmation flow

Acceptance:

- end-to-end create/edit/move/delete works with preview and confirmation.

## Milestone 3: Index consistency + UX polish

- batch post-apply reindex
- progress and failure recovery in UI
- run history in LLM log or dedicated store

Acceptance:

- after apply, query + graph reflect updated vault state without manual refresh.

## Milestone 4: Hardening

- limits, retries, conflict edge cases
- E2E coverage for agent flows
- optional git helpers (stage/commit prompt after apply)

## Testing Plan

## Unit

- path guard and traversal prevention
- plan schema validation
- operation validator rules
- mutation executor edge cases

## Integration

- orchestrator plan -> preview
- apply -> file tree update -> reindex triggered

## E2E

- agent create doc
- agent rewrite existing doc
- agent move doc between folders
- agent delete doc with confirmation

## Open Decisions

1. Agent trigger UX:
   - explicit `/agent ...` vs auto-detect intent
2. Confirmation policy:
   - always require apply click vs auto-apply for low-risk actions
3. Git integration:
   - offer commit prompt after every apply vs optional manual action

## Recommended defaults for v0.1

- explicit `/agent` trigger
- always preview + explicit apply
- optional git prompt after successful apply
