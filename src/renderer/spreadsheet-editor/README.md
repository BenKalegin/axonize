# spreadsheet-editor

Self-contained React component for editing GFM markdown tables with a spreadsheet-like UI. Designed to be extractable into its own package — has no imports outside this folder.

## Usage

```tsx
import { SpreadsheetEditor } from './spreadsheet-editor'
import './spreadsheet-editor/styles.css'

<SpreadsheetEditor
  initialMarkdown={tableMarkdown}
  onApply={(markdown) => setDraft(markdown)}
  onCancel={() => close()}
/>
```

The component is unstyled at the modal/panel level — the host wraps it in whatever chrome it wants. The component renders its own header bar (insert/delete row+col, Apply, Cancel) and a focusable grid.

## Public API

- `SpreadsheetEditor` — React component. Props: `{ initialMarkdown, onApply, onCancel }`.
- `parseGfmTable(markdown)` — returns `GfmTableModel | null`.
- `serializeGfmTable(model)` — returns markdown string.
- `createEmptyTable(columns, rows)` — convenience factory.
- Types: `GfmTableModel`, `ColumnAlign`, `CellAddress`, `HEADER_ROW`.

## Keyboard

- Arrow keys — move selection.
- Ctrl/Cmd + Arrow — jump to the edge of contiguous data in that direction.
- Tab / Shift+Tab — move horizontally.
- Enter / F2 — start editing the selected cell.
- Type any character — start editing and replace the cell with that character.
- Enter (while editing) — commit and move down.
- Tab (while editing) — commit and move right.
- Escape — cancel edit if editing, otherwise close the editor.
- Delete / Backspace — clear the selected cell.

## Theming

Styles use CSS custom properties with sensible fallbacks. The component renders correctly with no host theme. To match a host theme, set on a parent element:

- `--sse-bg` — base background
- `--sse-bg-surface` — header / row gutter background
- `--sse-bg-overlay` — hover background
- `--sse-border` — grid lines, button borders
- `--sse-text` — primary text
- `--sse-text-muted` — gutter labels, secondary text
- `--sse-accent` — selection outline, primary button
- `--sse-font-mono` — grid font family

## Round-trip semantics

`parseGfmTable` + `serializeGfmTable` is lossless for: header row, data rows, per-column alignment (left/center/right/default), and cells containing escaped pipes (`\|`). Non-GFM extensions (cell colors, merged cells, formulas) are not represented in the model and are not preserved.

## Extraction

This folder has no imports outside itself. To publish as a standalone npm package:

1. Move the folder to a new repo.
2. Add `package.json` with `react` and `react-dom` as peerDependencies.
3. Choose a bundler (tsup, vite-lib, rollup) targeting esm + types.
4. Move `styles.css` to a side-effect-importable entry, or inline via CSS-in-JS.
