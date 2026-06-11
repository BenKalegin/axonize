# Lint Demo

This file intentionally violates the three new Tier-1 prose lint rules. Delete after testing.

### Skipped Level

The heading above jumps from h1 to h3 — `heading-structure` should flag it as a warning.

## 1. First Numbered Section

The deterministic core idea means every transformation must be reproducible from the stored inputs without any model call involved at render time.

## 2. Second Numbered Section

Some unrelated filler about release automation, certificate management, and continuous integration pipelines.

## 4. Numbering Gap

The deterministic core idea means each transformation must be reproducible from the stored inputs without any model call involved at render time.

The numbered headings jump 2 → 4 (`heading-structure`, info), and the paragraph in section 1 reappears above with one word changed (`lexical-repetition`, ~90% similar).

## Code Fences

```
This fence has no language tag — code-fence-hygiene, info.
```

```pyton
print("typo in language tag — code-fence-hygiene, warning")
```

```typescript
const fine = true // labeled with a known language — no issue
```
