# HTML & Interactive Islands in Axonize

> Inspired by Claude Code's ["The Unreasonable Effectiveness of HTML"](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html) blog post

![Claude HTML Effectiveness](./claude-html-effectiveness-og.jpg)

---

## Ideas at a Glance

1. **[Support HTML islands in Axonize](#1-html-islands-in-axonize)** — Enable HTML rendering alongside markdown for richer, more expressive content
2. **[Interactive islands with JS/Python](#2-interactive-islands)** — Make islands dynamic and controllable, similar to Jupyter notebooks
3. **[Enhanced AI editing capabilities](#3-enhanced-ai-editing-experience)** — Make "rewrite with AI" more visible and contextual, add SVG editing support

---

## Background: The Claude Code HTML Philosophy

### Summary

The Claude Code team increasingly uses HTML instead of Markdown for AI-generated outputs. Why?

**Key Benefits:**
- **Richer expressiveness** — Tables with styling, interactive elements, spatial data, custom visualizations
- **Better readability** — Visual organization with tabs, illustrations, responsive layouts
- **Easier sharing** — HTML files render natively in browsers, shareable via simple links
- **Interactive prototyping** — Sliders, knobs, live previews for design/algorithm tuning
- **Deep context integration** — Leverage Claude Code's ability to read file systems, MCPs, git history

### When HTML Beats Markdown

| Use Case | Why HTML? |
|----------|-----------|
| **Specs & Planning** | Rich canvas for explorations, mockups, implementation plans with visual hierarchy |
| **Code Review** | Render diffs with annotations, color-coded findings, flowcharts |
| **Design Prototyping** | Interactive animations, tunable parameters, live previews |
| **Reports & Research** | SVG diagrams, collapsible sections, integrated visualizations |
| **Custom Editors** | Purpose-built UIs for specific tasks (ticket triage, config editing, prompt tuning) |

### Common HTML Patterns in Claude Code

1. **Specs with visual hierarchy** — Tabs, collapsible sections, inline mockups
2. **Interactive explorers** — Sliders/knobs for parameter tuning with "copy to clipboard" export
3. **Code documentation** — Syntax-highlighted diffs with inline annotations
4. **Comparison grids** — Side-by-side design alternatives with labeled tradeoffs
5. **Data editors** — Drag-and-drop interfaces with export buttons (e.g., ticket prioritization)
6. **Live previews** — Edit templates/prompts with real-time rendering

---

## 1. HTML Islands in Axonize

### Vision

Extend Axonize's island model to support **HTML islands** alongside existing prose, tables, diagrams, and semantic graphs.

### Implementation Approach

From the [focused-islands-vision.md](../focused-islands-vision.md):

> A markdown file is a sequence of typed regions: prose, table, diagram, semantic graph, chart, structured data...

**Add HTML as a new island type:**

```markdown
## Regular Markdown Section

Some prose content here.

```html
<!-- HTML Island -->
<div class="interactive-demo">
  <h3>Feature Comparison</h3>
  <table style="border-collapse: collapse;">
    <tr style="background: #f0f0f0;">
      <th>Feature</th><th>Basic</th><th>Pro</th>
    </tr>
    <tr>
      <td>Users</td>
      <td style="color: green;">✓ 5</td>
      <td style="color: green;">✓ Unlimited</td>
    </tr>
  </table>
</div>
```

Back to markdown prose...
```

### Two Modes for HTML Islands

Following the focused-islands pattern:

| Mode | Behavior |
|------|----------|
| **Read mode (in-flow)** | Sandboxed HTML rendering in the document flow. Safe subset of HTML/CSS, no external scripts |
| **Focus mode** | Full-screen HTML preview with live editing capabilities. Code editor on one side, preview on the other |

### Decision Rubric Check

Applying the focused-islands [decision rubric](../focused-islands-vision.md#decision-rubric-for-new-island-types):

1. ✅ **Markdown representation** — Fenced code blocks with `html` language tag (standard)
2. ✅ **Read-mode rendering** — Sandboxed iframe or shadow DOM for safe rendering
3. ✅ **Round-trip story** — HTML source is the source of truth, stored verbatim in markdown
4. ✅ **Value over source editing** — Visual preview, live editing, agent-assisted HTML generation
5. ✅ **Agent suggestions**:
   - "Add interactive table with sortable columns"
   - "Create a comparison grid for these options"
   - "Generate SVG diagram from this data"
   - "Make this section collapsible"
   - "Add syntax-highlighted code diff"

**Conclusion:** HTML islands qualify for focus mode.

### Safety Considerations

- **Sandboxing in read mode**: Use iframe with `sandbox` attribute or shadow DOM isolation
- **Script restrictions**: Default to `<script>` disabled in read mode, enable in focus mode with user consent
- **Content Security Policy**: Restrict external resources, inline styles/scripts only
- **XSS prevention**: Sanitize HTML on paste/import (use DOMPurify or similar)

---

## 2. Interactive Islands

### Vision: Jupyter-Style Interactivity

Transform static islands into **interactive, executable environments** where users can:

1. **Manipulate data** with sliders, inputs, dropdowns
2. **Execute code** (JavaScript or Python) to update visualizations
3. **Export state** to continue work elsewhere
4. **Collaborate** by sharing interactive documents

### Conceptual Model

Think of each interactive island as a **mini-app** embedded in the document:

```markdown
## Algorithm Tuning

```interact:js
<div>
  <label>Learning Rate: <input type="range" id="lr" min="0.001" max="0.1" step="0.001" value="0.01"></label>
  <span id="lr-val">0.01</span>

  <canvas id="loss-curve" width="400" height="200"></canvas>
</div>

<script>
const lr = document.getElementById('lr');
const lrVal = document.getElementById('lr-val');
const canvas = document.getElementById('loss-curve');
const ctx = canvas.getContext('2d');

function drawLossCurve(learningRate) {
  // Simulate loss curve based on learning rate
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  // ... drawing logic
}

lr.addEventListener('input', (e) => {
  lrVal.textContent = e.target.value;
  drawLossCurve(parseFloat(e.target.value));
});

drawLossCurve(0.01);
</script>
```
```

### Python Kernel Support (Future)

For data science workflows, embed Python execution:

```markdown
```interact:python
import matplotlib.pyplot as plt
import numpy as np

# User-adjustable parameters
frequency = slider(min=1, max=10, value=5, label="Frequency")
amplitude = slider(min=0.1, max=2, value=1, label="Amplitude")

# Generate and plot
t = np.linspace(0, 2*np.pi, 1000)
y = amplitude * np.sin(frequency * t)

plt.plot(t, y)
plt.title(f"Sin wave: A={amplitude}, f={frequency}")
plt.show()
```
```

**Implementation**: Integrate [Pyodide](https://pyodide.org/) (Python in WebAssembly) or connect to a local/remote Python kernel.

### Interactive Island Types

| Type | Use Case | Example |
|------|----------|---------|
| **Parameter tuner** | Algorithm/design exploration | Sliders for colors, timing, coefficients |
| **Data filter** | Dataset exploration | Checkboxes/dropdowns to filter table rows |
| **Live preview** | Template/prompt editing | Edit left, see output right |
| **Drag-and-drop** | Prioritization, organization | Ticket triage, file structure planning |
| **State exporter** | Save/share configurations | "Copy as JSON/Prompt" buttons |

### Agent Suggestions for Interactive Islands

When focused on an interactive island:

- "Add a reset button to restore defaults"
- "Export current state as JSON"
- "Create a comparison mode with two parameter sets"
- "Add keyboard shortcuts for quick adjustments"
- "Generate a shareable URL with current parameters"

### Integration with Focused Islands

- **Read mode**: Show last saved state as static snapshot
- **Focus mode**: Full interactivity enabled, state persisted on exit
- **Round-trip**: Serialize state as JSON in HTML comments or data attributes

---

## 3. Enhanced AI Editing Experience

### Current State (from focused-islands-vision)

> Each focused island exposes a context-aware suggestion surface...
> Suggestions appear on **explicit pull** (hotkey/button) or **smart pull** (detected pause + high-signal context).

### Proposal: Make "Rewrite with AI" More Visible

#### Problem

AI editing capabilities are powerful but often hidden. Users may not know they can:
- Rewrite a section in a different tone
- Generate SVG diagrams from descriptions
- Refactor table data into charts
- Enhance prose with visual aids

#### Solution: Contextual AI Action Bar

When hovering over or selecting content in focus mode, show a **floating AI action bar**:

```
┌────────────────────────────────────────────┐
│ [✨ Rewrite] [📊 Visualize] [🎨 Enhance]  │
└────────────────────────────────────────────┘
       ↑
   Selected text/island
```

**Actions by island type:**

| Island Type | AI Actions |
|-------------|------------|
| **Prose** | Rewrite (tone/length), Summarize, Add diagram, Translate |
| **Table** | Generate chart, Pivot/sort, Add formula column, Export as HTML |
| **Diagram** | Convert to SVG, Regenerate with changes, Add annotations |
| **HTML** | Refactor structure, Add interactivity, Generate from description |

#### SVG Generation & Editing

From your note: "add svgs" — Make SVG creation a first-class citizen:

**Prose → SVG:**
```markdown
The authentication flow starts with a user login,
validates credentials against the database,
generates a JWT token, and returns it to the client.

[✨ Generate SVG diagram from this description]
```

**Result:**
```markdown
The authentication flow starts with...

<svg viewBox="0 0 400 200">
  <rect x="10" y="50" width="80" height="40" />
  <text x="50" y="75">Login</text>
  <!-- ... full flow diagram -->
</svg>
```

**SVG Editing in Focus Mode:**
- **Visual editor**: Drag nodes, edit text, adjust colors
- **Code editor**: Direct SVG source editing with live preview
- **AI assist**: "Move Database to the right", "Add error flow", "Use blue theme"

### Smart Pull Triggers for AI Suggestions

Based on focused-islands-vision's [smart-pull heuristics](../focused-islands-vision.md#detecting-a-smart-pull-moment):

1. **Pause after activity** — N seconds of no input → suggest improvements
2. **Completion-shaped state** — Table filled, diagram complete → suggest derived views
3. **Repetition signal** — Same edit 3x → offer to generalize
4. **Paste of structured content** — CSV/JSON pasted → offer to visualize/transform

**Axonize-specific additions:**
- **Markdown → HTML conversion**: Detect complex tables/layouts → "Convert to interactive HTML?"
- **Prose → Diagram**: Detect flow/architecture description → "Generate SVG diagram?"
- **Data → Chart**: Table with numeric columns → "Create chart from this data?"

### UI Mockup: AI Action Bar

```
┌─ Focused Island: Table ──────────────────────────┐
│                                                   │
│  | Product  | Q1    | Q2    | Q3    |            │
│  |----------|-------|-------|-------|            │
│  | Widget A | $100k | $120k | $150k |            │
│  | Widget B | $80k  | $90k  | $95k  |            │
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │ ✨ AI: [📊 Add chart] [📈 Add trend]     │   │
│  │       [🔄 Pivot by quarter]              │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Ideas Concurrence with Focused-Islands Vision

### Aligned Concepts

1. **Island-based architecture** ✅
   - Both envision typed regions with specialized renderers
   - HTML/interactive islands fit naturally into this model

2. **Focus mode pattern** ✅
   - Read mode = compact, in-flow rendering
   - Focus mode = full-featured editing environment
   - Perfect for HTML and interactive islands

3. **Agent suggestions** ✅
   - Focused-islands already plans for context-aware AI assists
   - HTML/interactivity adds more suggestion opportunities

4. **Round-trip markdown** ✅
   - All islands serialize back to markdown (source of truth)
   - HTML islands store as fenced code blocks
   - Interactive state stored as JSON in comments/attributes

### Extensions to the Vision

1. **Interactivity as a first-class concern**
   - Focused-islands focuses on static content with AI editing
   - This proposal adds runtime interactivity (JS/Python execution)

2. **HTML as a rendering target**
   - Focused-islands uses domain-specific renderers (Mermaid, GFM tables)
   - HTML islands provide a universal, expressive fallback

3. **Jupyter-style workflows**
   - Focused-islands = document-centric
   - Interactive islands = code-notebook-centric
   - Both complement each other

---

## Implementation Roadmap

### Phase 1: HTML Island MVP
- [ ] Sandboxed HTML rendering in read mode (iframe or shadow DOM)
- [ ] Focus mode with split editor/preview
- [ ] Basic security (CSP, no external scripts)
- [ ] Agent prompt: "Generate HTML for [use case]"

### Phase 2: Enhanced AI Integration
- [ ] Contextual AI action bar on hover/select
- [ ] Prose → SVG diagram generation
- [ ] Table → HTML/chart conversion
- [ ] Smart pull triggers for HTML suggestions

### Phase 3: Interactive Islands
- [ ] JavaScript execution in isolated scope
- [ ] Parameter UI helpers (sliders, inputs, dropdowns)
- [ ] State serialization/persistence
- [ ] "Export state" buttons

### Phase 4: Python Kernel (Future)
- [ ] Pyodide integration for in-browser Python
- [ ] Matplotlib/Plotly rendering
- [ ] Variable inspector/debugger
- [ ] Kernel management (start/stop/reset)

---

## Open Questions

1. **Security model**: How much JavaScript freedom in read vs focus mode?
   - Proposal: Read mode = static only, focus mode = interactive with warnings

2. **State persistence**: Where to store interactive island state?
   - Proposal: JSON in HTML comments, sync to markdown on focus exit

3. **Python kernel**: In-browser (Pyodide) vs remote kernel?
   - Proposal: Start with Pyodide for simplicity, add remote kernel later

4. **Performance**: Large HTML islands in read mode?
   - Proposal: Lazy rendering (only render visible islands)

5. **Collaboration**: How to share interactive states?
   - Proposal: Export as self-contained HTML file with embedded state

6. **AI model context**: Do we send HTML/JS code to AI for editing?
   - Proposal: Yes, but sanitize/truncate large blobs

---

## Related Documents

- [Focused Islands Vision](../focused-islands-vision.md) — Core island architecture
- [Claude Blog: HTML Effectiveness](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html) — Original inspiration

---

## Appendix: Use Case Examples

### Example 1: Interactive Color Palette Editor

```html
<div class="color-palette">
  <h3>Brand Colors</h3>
  <div class="color-grid">
    <div>
      <input type="color" id="primary" value="#007bff">
      <label>Primary</label>
    </div>
    <div>
      <input type="color" id="secondary" value="#6c757d">
      <label>Secondary</label>
    </div>
  </div>
  <button onclick="copyToClipboard()">Copy CSS</button>
</div>

<style>
.color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.color-grid > div { text-align: center; }
.color-grid input[type="color"] { width: 100px; height: 100px; border: none; }
</style>

<script>
function copyToClipboard() {
  const css = `
    --primary: ${document.getElementById('primary').value};
    --secondary: ${document.getElementById('secondary').value};
  `;
  navigator.clipboard.writeText(css);
  alert('Copied to clipboard!');
}
</script>
```

**Agent suggestion**: "Add a preview section showing buttons/cards with these colors"

---

### Example 2: Algorithm Visualization

```html
<div class="sorting-demo">
  <canvas id="canvas" width="600" height="300"></canvas>
  <div class="controls">
    <label>Speed: <input type="range" id="speed" min="10" max="200" value="50"></label>
    <button onclick="bubbleSort()">Bubble Sort</button>
    <button onclick="quickSort()">Quick Sort</button>
  </div>
</div>

<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let array = Array.from({length: 50}, () => Math.random() * 280 + 10);

function drawArray() { /* rendering logic */ }
function bubbleSort() { /* animated sort */ }
function quickSort() { /* animated sort */ }

drawArray();
</script>
```

**Agent suggestion**: "Add step-by-step explanation as the sort progresses"

---

### Example 3: Feature Flag Editor

```html
<div class="feature-flags">
  <h3>Production Feature Flags</h3>
  <table>
    <tr>
      <th>Flag</th><th>Enabled</th><th>Dependencies</th>
    </tr>
    <tr>
      <td>dark_mode</td>
      <td><input type="checkbox" id="dark_mode"></td>
      <td>—</td>
    </tr>
    <tr>
      <td>new_dashboard</td>
      <td><input type="checkbox" id="new_dashboard"></td>
      <td>dark_mode ⚠️</td>
    </tr>
  </table>
  <button onclick="exportConfig()">Export JSON</button>
</div>

<script>
function exportConfig() {
  const config = {
    dark_mode: document.getElementById('dark_mode').checked,
    new_dashboard: document.getElementById('new_dashboard').checked,
  };
  navigator.clipboard.writeText(JSON.stringify(config, null, 2));
}

// Dependency validation
document.getElementById('new_dashboard').addEventListener('change', (e) => {
  if (e.target.checked && !document.getElementById('dark_mode').checked) {
    alert('Warning: new_dashboard requires dark_mode to be enabled');
  }
});
</script>
```

**Agent suggestion**: "Load current config from file and highlight differences"

---

## Conclusion

By embracing HTML islands and interactivity, Axonize can become more than a markdown editor — it becomes a **thinking environment** where ideas are explored, prototyped, and refined through rich, interactive documents. This aligns perfectly with the focused-islands vision while adding new dimensions of expressiveness and engagement.

The key is to maintain markdown as the source of truth while allowing HTML/JS/Python to provide richer rendering and interaction when needed. Users stay in the loop, agents stay helpful, and documents stay shareable.

Let's make Axonize the best place to think with AI. 🚀
