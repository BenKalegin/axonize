import { describe, it, expect } from 'vitest'
import { buildVaultLintContext, lintVault } from '@core/markdown/lint/vault/vault-linter'
import { checkOrphanedImages } from '@core/markdown/lint/vault/orphaned-images'
import { checkGlossaryCollisions } from '@core/markdown/lint/vault/glossary-collisions'
import type { VaultLintContext } from '@core/markdown/lint/vault/types'

function ctx(files: Record<string, string>, assets: string[] = []): VaultLintContext {
  const contents = new Map(Object.entries(files))
  const vaultFiles = new Set([...Object.keys(files), ...assets])
  return buildVaultLintContext('/vault', vaultFiles, contents)
}

describe('checkOrphanedImages', () => {
  it('passes when every image is referenced by a markdown image node', () => {
    const c = ctx({ 'doc.md': '![logo](images/logo.png)' }, ['images/logo.png'])
    expect(checkOrphanedImages(c)).toHaveLength(0)
  })

  it('resolves relative references from nested documents', () => {
    const c = ctx({ 'notes/doc.md': '![d](../images/deep.png)' }, ['images/deep.png'])
    expect(checkOrphanedImages(c)).toHaveLength(0)
  })

  it('counts wikilink embeds as references by basename', () => {
    const c = ctx({ 'doc.md': 'Embedded: ![[photo.png]]' }, ['attachments/photo.png'])
    expect(checkOrphanedImages(c)).toHaveLength(0)
  })

  it('flags an image referenced by nobody', () => {
    const c = ctx({ 'doc.md': 'No images here.' }, ['images/unused.png'])
    const issues = checkOrphanedImages(c)
    expect(issues).toHaveLength(1)
    expect(issues[0].relativePath).toBe('images/unused.png')
    expect(issues[0].message).toMatch(/not referenced/)
  })

  it('ignores non-image assets', () => {
    const c = ctx({ 'doc.md': 'text' }, ['data/records.csv'])
    expect(checkOrphanedImages(c)).toHaveLength(0)
  })

  it('ignores external and data-uri references when collecting', () => {
    const c = ctx({ 'doc.md': '![x](https://example.com/a.png)' }, ['a.png'])
    const issues = checkOrphanedImages(c)
    expect(issues).toHaveLength(1)
  })
})

describe('checkGlossaryCollisions', () => {
  it('passes when a term is defined once', () => {
    const c = ctx({ 'a.md': '**Island** — a self-contained content block in a document.' })
    expect(checkGlossaryCollisions(c)).toHaveLength(0)
  })

  it('passes when duplicate definitions agree', () => {
    const def = '**Island** — a self-contained content block.'
    const c = ctx({ 'a.md': def, 'b.md': def })
    expect(checkGlossaryCollisions(c)).toHaveLength(0)
  })

  it('flags the same term defined differently across documents', () => {
    const c = ctx({
      'a.md': '**Island** — a self-contained content block in a document.',
      'b.md': '**Island**: an isolated rendering region with its own focus mode.'
    })
    const issues = checkGlossaryCollisions(c)
    expect(issues).toHaveLength(1)
    expect(issues[0].relativePath).toBe('b.md')
    expect(issues[0].message).toMatch(/a\.md:1/)
    expect(issues[0].severity).toBe('warning')
  })

  it('flags differing definitions within one document', () => {
    const c = ctx({
      'a.md':
        '**Vault** — the root folder of a knowledge base.\n\n' +
        'Filler paragraph.\n\n' +
        '**Vault** — an encrypted storage location for secrets.'
    })
    const issues = checkGlossaryCollisions(c)
    expect(issues).toHaveLength(1)
    expect(issues[0].line).toBe(5)
  })

  it('detects definitions in list items', () => {
    const c = ctx({
      'a.md': '- **Card** — a semantic unit extracted from a document.',
      'b.md': '- **Card** — a UI panel with rounded corners and a shadow.'
    })
    expect(checkGlossaryCollisions(c)).toHaveLength(1)
  })

  it('is case-insensitive on the term', () => {
    const c = ctx({
      'a.md': '**island** — a self-contained content block in markdown.',
      'b.md': '**Island** — a tropical landmass surrounded by water entirely.'
    })
    expect(checkGlossaryCollisions(c)).toHaveLength(1)
  })

  it('ignores bold text without a definition separator', () => {
    const c = ctx({
      'a.md': '**Note** that this is emphasis, not a definition of anything.',
      'b.md': '**Note** that this is also just emphasis in running prose.'
    })
    expect(checkGlossaryCollisions(c)).toHaveLength(0)
  })

  it('ignores too-short definitions', () => {
    const c = ctx({ 'a.md': '**Key**: value\n\n**Key**: other', 'b.md': '' })
    expect(checkGlossaryCollisions(c)).toHaveLength(0)
  })

  it('suppresses lockstep template labels even at few sites', () => {
    const entry = (n: number) =>
      `## Enhancement ${n}\n\n` +
      `**Problem**: a unique problem statement number ${n} here.\n\n` +
      `**Implementation approach**: the distinct approach number ${n} described.\n\n`
    const c = ctx({ 'a.md': entry(1) + entry(2) })
    expect(checkGlossaryCollisions(c)).toHaveLength(0)
  })

  it('keeps a lone repeating term despite other single-site terms in the doc', () => {
    const c = ctx({
      'a.md':
        '**Vault** — the root folder of a knowledge base.\n\n' +
        '**Island** — a self-contained content block in markdown.\n\n' +
        '**Vault** — an encrypted storage location for secrets.'
    })
    expect(checkGlossaryCollisions(c)).toHaveLength(1)
  })

  it('suppresses recurring field labels used by repeated templates', () => {
    const entry = (n: number) =>
      `## Entry ${n}\n\n` +
      `- **Paper**: the ${n}th study about retrieval pipelines\n` +
      `- **Problem**: a different problem statement number ${n}\n`
    const c = ctx({ 'a.md': entry(1) + entry(2) + entry(3) + entry(4) })
    expect(checkGlossaryCollisions(c)).toHaveLength(0)
  })

  it('still flags a term defined differently at up to three sites', () => {
    const c = ctx({
      'a.md': '**Island** — a self-contained content block in a document.',
      'b.md': '**Island** — an isolated rendering region with focus mode.',
      'c.md': '**Island** — a self-contained content block in a document.'
    })
    expect(checkGlossaryCollisions(c)).toHaveLength(1)
  })
})

describe('lintVault', () => {
  it('runs per-file rules across all documents and tags issues with paths', () => {
    const c = ctx({
      'clean.md': '# Fine\n\nNothing wrong here.',
      'bad.md': '# A\n### Skipped'
    })
    const issues = lintVault(c)
    const byFile = new Set(issues.map((i) => i.relativePath))
    expect(byFile.has('bad.md')).toBe(true)
    expect(byFile.has('clean.md')).toBe(false)
    expect(issues.some((i) => i.ruleId === 'heading-structure')).toBe(true)
  })

  it('resolves cross-document links via loaded contents', () => {
    const c = ctx({
      'a.md': '[link](./b.md#real-heading)',
      'b.md': '# Real Heading'
    })
    expect(lintVault(c).filter((i) => i.ruleId === 'broken-link')).toHaveLength(0)
  })

  it('combines per-file and vault-wide findings sorted by file then line', () => {
    const c = ctx(
      {
        'a.md': '**Term** — definition number one for this term.',
        'z.md': '**Term** — a completely different second definition.'
      },
      ['orphan.png']
    )
    const issues = lintVault(c)
    expect(issues.map((i) => i.ruleId)).toContain('orphaned-image')
    expect(issues.map((i) => i.ruleId)).toContain('glossary-collision')
    const paths = issues.map((i) => i.relativePath)
    expect(paths).toEqual([...paths].sort())
  })
})
