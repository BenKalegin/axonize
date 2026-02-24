# Axonize

Axonize is a TypeScript + Electron desktop app (mac-focused v0.1) for Git-native semantic Markdown documentation.

## v0.1 Scope

- Markdown in `docs/` is canonical source of truth.
- `.semantic/` is a deterministic, disposable sidecar:
  - `state.json`
  - `nodes.json`
  - `edges.json`
  - `cache/`
- Deterministic edge build from links, heading hierarchy, and explicit relation annotations.
- Incremental rebuild based on per-file hashes.
- Command-based editing (`rewrite`) with diff preview and optional apply.
- Spatial read projection with radial semantic orbit and zoom abstraction levels (Z4 → Z0).
- Theme support: `System`, `Light`, and `Dark` (runtime switch).

## Desktop App Structure

```
desktop/
  main/
    main.ts
    preload.ts
    semantic/
      engine.ts
      markdown.ts
      graph.ts
      integrity.ts
      storage.ts
      command.ts
      models.ts
  renderer/
    index.html
    styles.css
    renderer.ts
```

## Run on macOS

1. Install dependencies:

```bash
npm install
```

2. Build app:

```bash
npm run build
```

3. Launch Electron:

```bash
npm start
```

Use `Choose Workspace` in the app to point Axonize at a folder containing `docs/*.md`.
You can also paste an absolute path in the top-bar workspace input and click `Set Path`.

### Debug-First Workspace Open

Open/switch the app directly to a target workspace (or `docs/` folder):

```bash
npm run open:workspace -- /absolute/path/to/workspace-or-docs
```

The app now supports `--workspace` / `AXONIZE_WORKSPACE` and single-instance switching, so repeated launches focus the same app window and update workspace.

### Single-App Control (Playwright Attach)

If you want one app instance only and scripted control of its UI:

1. Start one debuggable app instance:

```bash
npm run start:debug
```

2. In another terminal, attach to that same running window and manipulate controls:

```bash
npm run control:workspace -- /absolute/path/to/workspace-or-docs --full
```

This attaches via CDP to the existing app (`localhost:9222`) and does not launch another app window.

## Playwright UI Automation

Playwright automation can read UI text and drive controls in the Electron app for debugging and regression checks.

Run E2E automation:

```bash
npm run test:e2e
```

Run headed mode:

```bash
npm run test:e2e:headed
```

Run a one-shot workspace debug snapshot (launch app, rebuild, print UI stats):

```bash
npm run debug:workspace -- /absolute/path/to/workspace-or-docs --full
```

## Notes

- The previous Python prototype remains in `src/axonize` for reference while the desktop app is brought up.
- If `.semantic/` is deleted or corrupted, rebuild regenerates it from Markdown.
