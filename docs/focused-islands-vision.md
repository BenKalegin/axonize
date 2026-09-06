# Focused islands — vision

A reference for decisions about how axonize handles non-text content in markdown documents. Used to evaluate "should we add a spreadsheet view?" and similar questions.

---

## The idea in one sentence

A markdown document is a stream of **islands** (prose, table, diagram, semantic graph, future: JSON/XML, chart). Each island has a default *read* rendering inside the markdown flow and a *focused* mode that takes over the panel with a domain-native editor — and in focused mode, an agent stands by with suggestions that are only meaningful in that island's context.

## The mental model: islands

A markdown file is not just text. It's a sequence of typed regions:

- **prose** — paragraphs, headings, lists
- **table** — GFM table
- **diagram** — mermaid (today), other doodle dialects later
- **semantic graph** — derived view across files (already exists)
- **chart** (future) — derived from a sibling table
- **structured data** (future) — JSON / XML / YAML tree

Each type has its own ideal editor. Forcing them all to share the same "edit the source markdown" affordance is the friction we're removing. The markdown source remains the single source of truth — it's the *interaction* that becomes type-aware.

## Two modes per island

**Read mode (in-flow):** the island renders inside the scrolling markdown view. It's a "photo" — diagrams don't accept drags, tables don't accept cell edits, charts don't accept resorts. Cheap, fast, scrollable.

**Focus mode (panel takeover):** double-click (or a focus affordance on hover) on an island and axonize zooms in — the panel switches from "markdown" to a view tab tailored to that island type. Same pattern as the existing `markdown | semantic graph` tabs, but the active tab set depends on what's under focus:

| Island | Focused view |
|---|---|
| prose | Presentation mode (slide-style focused text, PPT-like controls) |
| table | Spreadsheet (cells, formulas, paste-from-Excel, derived chart) |
| diagram | Live diagram editor (drag nodes, route edges, agent edits) |
| semantic graph | The existing graph view |
| JSON/XML (future) | Tree editor with validate/format |

A consistent escape — click "back to markdown" or press Esc — returns to the in-flow view. The markdown source is rewritten on exit (and ideally during the edit, via a debounced sync).

## Why focus mode matters: the live↔photo distinction

In a brainstorm or design review, the slow part of working with diagrams in tools like Rational Rose or Enterprise Architect is *not* the rendering — it's the manipulation:

1. You see the issue ("we need a CloudFront between the ALB and the user").
2. You look away from the diagram to a component palette to find the right node.
3. You drag-drop the node into rough position (no intelligence).
4. You manually move every neighbor to make room.
5. Edges are now ugly. You re-route them.
6. Two minutes later you remember what you were trying to communicate.

This kills the flow of a live session. The fix isn't a fancier palette — it's making the change expressible at the level of intent: *"insert CloudFront between ALB and browser"*, *"convert this container TB → LR"*, *"swap these two sections"*, *"centralize this node"*. The agent picks the node, places it, re-runs auto-layout (filigree), reroutes edges. One step instead of seven.

That only works when the island is **live** — focused. In-flow mode is intentionally read-only so scroll stays cheap and the document feels stable.

## The agentic layer

Each focused island exposes a context-aware suggestion surface:

- **Focused on a table:** "Add a bar chart for this data below", "Pivot by column X", "Sort by Y", "Fill the third column from a formula across columns A and B".
- **Focused on a diagram:** "Insert CloudFront between ALB and browser", "Convert this container TB → LR", "Centralize the auth-service node", "Group these three into a VPC container".
- **Focused on prose (presentation mode):** "Tighten this slide", "Add a closing summary slide", "Pull a diagram from section 3 to illustrate this point".
- **Focused on a JSON tree (future):** "Validate against schema X", "Promote this nested key to the root", "Generate a TypeScript type".

Suggestions are derived from:

1. **The island content** itself (the table data, the diagram graph, the prose text).
2. **The surrounding document context** (sibling sections, file title, frontmatter).
3. **The session intent** if available (recent agent turns, recent edits).

The contract: a suggestion is a *one-click intent* whose result is a deterministic edit to either (a) the focused island, or (b) the surrounding markdown (e.g. "add a chart after this table" inserts a new island below).

## When suggestions appear (pull, not push)

Suggestions are an *attention cost* on the user, not a free feature. Every unsolicited surface — a panel of three follow-ups after each agent reply, a "did you mean…" banner after every cell edit — adds latency, LLM cost, and disruption. The default must be: **don't suggest unless the user signals they want suggestions**. Three acceptable triggers:

1. **Explicit pull.** A hotkey or button — the IDE pattern. VS Code Copilot's invoke, IntelliJ's context-aware menu (it knows whether the caret is on a method or a variable). The user knows they want help; the agent responds with 1–2 high-relevance options derived from the focused island's content.
2. **Smart pull on detected pause + high-signal context.** The intellidraw experiment explored this: while the user draws, watch for a quiet moment plus a recognizable shape, then surface a single suggestion. The threshold to fire is "the value of suggesting now plausibly exceeds the cost of interrupting". Copilot's inline completions are the canonical version; PowerPoint Designer ("Design Ideas" appearing when you paste structured content) is a close cousin. We do this only when a clear local signal exists — not on every edit.
3. **Action confirmations.** When the user is in the middle of a multi-step intent ("agent edits a diagram and asks: should I also re-layout?"), a single inline confirm is fine. This is not a suggestion — it's the agent finishing its own turn.

What we explicitly do not do: **push suggestions after every agent response**. The "here are three things you could ask next" panel pattern from chat UIs is rejected for axonize. Reasons: (a) costs an extra LLM call per turn for diminishing return; (b) adds latency to the perceived "done"; (c) pulls focus away from the document the user came here to work on; (d) the suggestions are usually bland because they're context-thin.

### Quality bar for surfaced suggestions

- **At most two at a time.** A list of five is a menu, not a suggestion. One is usually correct.
- **High confidence only.** A weak suggestion is worse than no suggestion — the user reads it, dismisses it, and the next one starts with negative trust.
- **One-click execution.** A suggestion the user has to translate into a prompt is a label, not a suggestion.
- **Context-grounded.** A suggestion must reference something specific in the focused island ("Add a chart for columns *Region* and *Revenue*", not "Add a chart"). If the agent can't ground it, it shouldn't surface it.

### Detecting a smart-pull moment

Heuristics worth trying when implementing the smart-pull path. All run locally (no LLM cost) and only fire an LLM call once a heuristic clears:

- **Pause after activity.** N seconds of no input following a burst of edits — the user has likely stopped to think.
- **Completion-shaped state.** A table where every cell has a value (data is ready to be analyzed). A diagram where a recently inserted node has no edges (the user may be wondering what to connect it to).
- **Repetition signal.** The user did the same micro-edit three times — they probably want it generalized ("Apply this format to the rest of the column?").
- **Paste of structured content.** Pasting an Excel table, a JSON blob, a CSV — high-signal moment to offer a transform.

If a smart-pull suggestion appears and the user dismisses it without acting, back off — don't re-surface the same class of suggestion in the same session.

## Helper presentations

Some suggestions don't replace the island — they spawn a sibling. "Add a chart for this data" creates a new chart island linked to the table. "Add a summary slide" creates a prose island. Helper presentations let one source of truth (the table) generate derived views (the chart) that stay in sync. The user works with the table; the chart updates.

This is where data analysis stops feeling like "export to a tool" and starts feeling like the markdown document is a workspace.

## What this rules in / out

### In
- A consistent in-flow read mode for every island type — small visual footprint, no surprises.
- A focus mode per island type, owned by a specialist component (e.g. clouddiagram-editor for diagrams).
- Agent suggestions scoped to the focused island, surfaced as a side panel or palette.
- Markdown remains the canonical store. Every focused-mode edit serializes back to standard markdown (with hint comments only if the island type genuinely needs them — see GFM constraints in the table case).

### Out
- A separate document type per island ("a `.diagram` file"). Everything lives in the markdown.
- Modal popups that obscure context. Focus mode is a *panel* takeover, not a dialog over a dimmed parent — the document outline / file tree / agent panel stay visible.
- Custom non-portable syntax extensions where the standard already covers the case. Lean on GFM, mermaid, etc.; only invent syntax when there is no standard.
- Treating "edit source markdown directly" as the universal fallback. It's available, but it should be the *escape hatch*, not the primary path for tables and diagrams.

## Decision rubric for new island types

When considering adding support for a new island type (spreadsheet, chart, JSON tree, …), evaluate against five questions:

1. **Does it already have a natural markdown representation?**
   *Table → yes (GFM). Chart → no, must derive. JSON → could be a fenced block.*
   If no, decide the storage shape before anything else.

2. **What's the read-mode rendering?**
   The in-flow view must be cheap and stable. If the read view requires the full editor to render, the island isn't a good fit for focus-mode separation.

3. **What's the round-trip story?**
   Can focus-mode edits be serialized back to markdown without lossy state? If state requires sidecar metadata, where does it live (hint comment, frontmatter, separate file)? *This is usually the hardest question.*

4. **What does focused-mode add over editing the source?**
   If the only win is "nicer cell editing", it's a small feature. If the win is "the agent can do interesting things only possible with a typed view", it's a strategic feature.

5. **What agent suggestions become possible?**
   Enumerate 3–5 concrete intents the agent could fulfill in focus mode. If you can't list five, the island type doesn't have enough surface to justify focus mode yet.

## Applying the rubric to the immediate question: spreadsheets

1. **Markdown representation** — GFM tables. Already standard. Lossless round-trip via remark-gfm. Per-column alignment is the only formatting GFM encodes; per-cell color/merge would require sidecar hints, which we should defer.
2. **Read-mode rendering** — already exists; styles in `layout.css:628`. No changes needed for in-flow view.
3. **Round-trip** — clean for GFM-native features. Risky for anything beyond GFM. Decision: v1 stays inside GFM.
4. **Value of focused mode** — paste from Excel, keyboard-navigable cell edits, derived-chart suggestions, sort/pivot, formula evaluation. Big.
5. **Agent suggestions** — "add chart for this data", "sort by column", "add column as A×B", "extract row to bullet list", "convert to JSON". Five concrete intents — passes the bar.

**Conclusion:** spreadsheet island qualifies for focus mode. Build it as the second instance of the focused-island pattern (after diagram, which already exists), and treat that build as the moment to extract the pattern into a reusable shape (an `IslandFocusView` contract: `read-render`, `focus-render`, `serialize`, `suggest`).

## Open questions

- **Trigger gesture.** Double-click is intuitive but conflicts with text selection. Consider: hover affordance + click, or a small "expand" icon in the island's top-right.
- **Multiple islands open?** v1 is single-focus (one island per panel at a time). Split-pane focus (e.g. table on left, derived chart on right) is a v2.
- **Sync direction during focus.** Should source markdown update on every cell edit, or only on focus exit? Live sync is nicer for the agent panel, but cheaper to ship as on-exit.
- **Where suggestions render.** When the pull-or-smart-pull trigger fires, do suggestions appear in the existing agent sidebar, as an inline strip above the island, or as a floating palette anchored to the cursor? Probably the agent sidebar for explicit pull (more room for context) and an inline strip for smart-pull (closer to the work). To validate on first island.
- **Smart-pull thresholds.** The pause/repetition/completion heuristics need calibration. Start conservative (suggestions almost never fire) and loosen — easier than apologizing for noise.
- **Helper presentations storage.** A derived chart could be (a) a new markdown island below the table, (b) a sidecar that re-derives on read, or (c) ephemeral until the user "save"s it. Decision deferred.
- **Mobile / small screens.** Focus mode is panel-sized; on very small viewports it may need to occupy the entire window. Not a near-term concern.

## Reference

- Existing focus-mode precedent: `src/renderer/components/Content/DiagramVisualEditorModal.tsx`, `VisualMermaidEditorModal.tsx` (modal-style today; the vision evolves these into panel takeovers).
- Existing in-flow renderer: `src/renderer/lib/markdown-renderer.ts`, `SectionBlock.tsx`.
- Tool comparison for spreadsheet grids: Handsontable (paid), Jspreadsheet CE (MIT), RevoGrid (MIT), or hand-rolled.
- Markdown round-trip: `remark-gfm` + `remark-stringify` (already deps).
