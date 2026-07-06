# Axonize Ideas & Proposals

This folder contains design proposals and vision documents for future Axonize features.

---

## Documents

### 1. [HTML & Interactive Islands](./html-and-interactive-islands.md)
**Status:** Proposal
**Inspired by:** [Claude Code HTML blog post](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html)

**Core ideas:**
- Support HTML islands alongside markdown for richer expressiveness
- Add interactive islands with JS/Python execution (Jupyter-style)
- Enhance AI editing with contextual action bars and SVG generation

**Key benefits:**
- More expressive than markdown (tables, interactivity, spatial layouts)
- Better for design exploration (sliders, live previews, parameter tuning)
- Easier to share (renders natively in browsers)

**Aligns with:** Focused-islands vision — HTML becomes a new island type with read/focus modes

---

### 2. [Knowledge Graph for KB Search](./knowledge-graph-for-kb-search.md)
**Status:** Proposal
**Inspired by:** [Graphify](https://github.com/safishamsi/graphify)

**Core idea:**
Build a queryable knowledge graph over Axonize's KB so agents search structure-first instead of grepping every file.

**How it works:**
1. Extract concepts and relationships from KB files (markdown, code, images)
2. Build NetworkX graph with nodes (concepts/files) and edges (relationships)
3. Use Leiden community detection to find clusters
4. Agents read graph report before searching → 5-10x fewer file reads

**Key features:**
- Local-first (no cloud, no telemetry)
- Incremental updates (only re-process changed files)
- Explainable (show path: concept A → B → C)
- Agent lexical search track: SQLite FTS trigram grep + BM25 tools over shared search segments
- Integrates as new island type (minimap in read mode, full viz in focus mode)

**Aligns with:** Focused-islands vision — knowledge graph as a new island type with specialized renderers

---

### 3. [Prose Lint & Refactor](./prose-lint-and-refactor.md)
**Status:** Implemented (Tier 1 + Tier 2; vault-wide lints in progress)
**Inspired by:** Claude Code's `/simplify` — refactor-after-append to hold quality flat as content grows

**Core idea:**
Documents accumulate structural entropy the same way code does — appended sections drift, duplicate, and go stale. Apply the `/simplify` idea to prose: a two-tier pass that keeps a markdown doc (or the whole vault) internally consistent and de-duplicated.

**How it works:**
1. **Tier 1 — deterministic lints** (local, no LLM): dead links, broken anchors, heading structure, lexical repetition, glossary collisions
2. **Tier 2 — LLM refactor pass** (Claude, on demand): de-duplicate, consolidate, tighten, tone-match — always as a reviewable diff, lossless on facts
3. Findings surface in a panel like the existing semantic errors; vault-wide lints reuse the knowledge-graph link index

**Aligns with:** Focused-islands vision — a cross-cutting quality layer over the shared markdown substrate (not a new island type)

---

## Ideas at a Glance

### From HTML & Interactive Islands
1. ✅ **HTML island type** — Render rich HTML in read mode, edit in focus mode
2. ✅ **Interactive islands** — JS/Python execution for dynamic content (parameter tuners, data editors)
3. ✅ **Enhanced AI editing** — Contextual action bar ("Rewrite", "Visualize", "Enhance")
4. ✅ **SVG generation** — Convert prose descriptions to diagrams
5. ✅ **Smart pull triggers** — Detect pause/completion/repetition → suggest improvements

### From Knowledge Graph
1. ✅ **Graph extraction pipeline** — 3-pass: structural → semantic → cross-reference
2. ✅ **Community detection** — Leiden algorithm finds topic clusters
3. ✅ **Agent PreSearch hook** — Read graph before blind file search
4. ✅ **Graph island UI** — Minimap (read mode) + interactive viz (focus mode)
5. ✅ **Incremental updates** — SHA256 cache, only re-extract changed files
6. ⬜ **Agent lexical search index** — SQLite FTS trigram grep + BM25 tools, vectors stay in the existing RAG store for now

### From Prose Lint & Refactor
1. ✅ **Deterministic lints** — dead links, broken anchors, heading structure, lexical repetition (local, no LLM)
2. ✅ **LLM refactor pass** — de-duplicate, consolidate, tighten, tone-match as a reviewable diff
3. ✅ **Lossless-on-facts invariant** — refactor trims words, never drops content
4. ✅ **Entropy-based trigger** — nudge a refactor when a doc drifts after incremental edits
5. ✅ **Vault-wide consistency** — cross-doc dead-link / glossary checks via the knowledge-graph link index

---

## Cross-Cutting Themes

Both proposals extend the **focused-islands vision**:

| Concept | HTML Islands | Knowledge Graph |
|---------|-------------|-----------------|
| **Island type** | HTML blocks | Graph minimap |
| **Read mode** | Sandboxed render | Node list / minimap |
| **Focus mode** | Split editor/preview | Interactive graph viz |
| **Round-trip** | HTML → markdown fence | Graph → JSON → minimap |
| **Agent suggestions** | "Add interactivity", "Generate SVG" | "Find related", "Explore community" |

Both emphasize:
- **Structure-aware AI** — Agents understand content type, not just text
- **Local-first** — No cloud dependencies, privacy-friendly
- **Incremental** — Fast updates, minimal re-computation
- **Explainable** — Users understand what AI is doing

---

## Implementation Priority

### High Priority (Next Quarter)
1. **HTML islands (MVP)** — Sandboxed rendering, focus mode editing
2. **Knowledge graph extraction** — Build graph for existing KBs, agent integration

### Medium Priority (Next 6 Months)
3. **Interactive islands** — JS execution, parameter tuners
4. **Graph island UI** — Minimap + focus mode visualization
5. **Enhanced AI editing** — Contextual action bars

### Future / Exploratory
6. **Python kernel** — Pyodide for Jupyter-style notebooks
7. **Temporal graphs** — Track KB evolution over git history
8. **Cross-KB graphs** — Link multiple knowledge bases
9. **Graph-guided authoring** — Suggest connections while writing

---

## Open Questions

### Technical
1. **Security model:** How much JS/HTML freedom in read vs focus mode?
2. **State persistence:** Where to store interactive island state?
3. **Graph commits:** Commit graph.json to git, or regenerate locally?
4. **LLM vs local:** Which graph passes require Claude, which can be local?

### UX
1. **Discovery:** How do users learn about islands and graph features?
2. **Defaults:** Should graph/HTML be opt-in or default-enabled?
3. **Feedback:** How to show agent is using graph (not blind grepping)?

### Performance
1. **Large KBs:** How to scale graph extraction to 10k+ files?
2. **Real-time updates:** How fast can graph refresh during active editing?
3. **Token costs:** What's acceptable LLM cost for graph maintenance?

---

## Related Documents

- [Focused Islands Vision](../focused-islands-vision.md) — Core island architecture
- [Claude Blog: HTML Effectiveness](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html)
- [Graphify GitHub](https://github.com/safishamsi/graphify)

---

## Contributing Ideas

To propose a new feature:

1. Create a new `.md` file in `docs/ideas/`
2. Include:
   - **Problem:** What user pain point does this solve?
   - **Vision:** What's the ideal experience?
   - **Architecture:** How would it work technically?
   - **Integration:** How does it fit with focused-islands vision?
   - **Metrics:** How would we measure success?
3. Apply the [decision rubric](../focused-islands-vision.md#decision-rubric-for-new-island-types) if proposing a new island type
4. Link from this README

---

**Last updated:** 2026-05-21
