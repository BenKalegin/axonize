# Playwright Electron Agent Guide

This guide is for future agents debugging Axonize UI issues.

## Why Electron Mode Matters

Axonize relies on preload bridge APIs exposed as `window.axonize`.
The WebPreview renderer at `http://localhost:5173` does not provide that bridge.
For renderer + preload + IPC behavior, use Playwright Electron mode.

## One-Time Setup

Install Playwright browser runtime on the machine:

```bash
npm exec playwright install chromium
```

## Test Entry Points

- Electron fixture: `tests/e2e/fixtures/electron-app.ts`
- Playwright config: `playwright.config.ts`
- E2E specs: `tests/e2e/*.spec.ts`

The fixture launches Electron from `out/main/index.js`, so build first.

## Standard Agent Workflow

1. Build app:

```bash
pnpm build
```

2. Run Electron E2E:

```bash
pnpm test:e2e:electron
```

3. Reproduce visually:

```bash
pnpm test:e2e:headed
```

4. Capture trace for difficult failures:

```bash
pnpm test:e2e:debug
```

## Practical Debug Pattern

1. Reproduce the issue in headed mode.
2. Add/adjust a focused spec under `tests/e2e/`.
3. Assert both:
- visible behavior (DOM/UI expectation)
- absence of runtime errors (`page.on('console')` / expected logs)
4. Keep the spec as a regression test when fixing code.

