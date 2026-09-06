import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '@core/markdown/frontmatter'

describe('parseFrontmatter', () => {
  it('parses flat scalar key/value pairs in order', () => {
    const raw = `---\ntype: Reference\ntitle: Badge Classes\n---\n`
    expect(parseFrontmatter(raw)).toEqual([
      { key: 'type', value: 'Reference' },
      { key: 'title', value: 'Badge Classes' }
    ])
  })

  it('keeps colons inside scalar values (URLs, timestamps)', () => {
    const raw = `---\nresource: https://example.com/q/2677\ntimestamp: 2026-05-28T23:32:40+00:00\n---`
    expect(parseFrontmatter(raw)).toEqual([
      { key: 'resource', value: 'https://example.com/q/2677' },
      { key: 'timestamp', value: '2026-05-28T23:32:40+00:00' }
    ])
  })

  it('strips matching surrounding quotes', () => {
    const raw = `---\ntitle: "My Doc"\ntimestamp: '2026-05-28T22:43:59+00:00'\n---`
    expect(parseFrontmatter(raw)).toEqual([
      { key: 'title', value: 'My Doc' },
      { key: 'timestamp', value: '2026-05-28T22:43:59+00:00' }
    ])
  })

  it('parses a YAML block list into a string array', () => {
    const raw = `---\ntype: BigQuery Table\ntags:\n- bitcoin\n- bigquery\n- blocks\ntitle: After\n---`
    expect(parseFrontmatter(raw)).toEqual([
      { key: 'type', value: 'BigQuery Table' },
      { key: 'tags', value: ['bitcoin', 'bigquery', 'blocks'] },
      { key: 'title', value: 'After' }
    ])
  })

  it('parses an inline array into a string array', () => {
    const raw = `---\ntags: [bitcoin, "bigquery", blocks]\n---`
    expect(parseFrontmatter(raw)).toEqual([
      { key: 'tags', value: ['bitcoin', 'bigquery', 'blocks'] }
    ])
  })

  it('keeps a comma-delimited scalar as a single string (not a list)', () => {
    const raw = `---\ntags: badges, classes, enum\n---`
    expect(parseFrontmatter(raw)).toEqual([
      { key: 'tags', value: 'badges, classes, enum' }
    ])
  })

  it('returns an empty array for an empty block', () => {
    expect(parseFrontmatter('---\n---')).toEqual([])
  })
})
