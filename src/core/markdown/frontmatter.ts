export interface FrontmatterEntry {
  key: string
  /** Scalar value, or a list of values for YAML sequences (rendered as chips). */
  value: string | string[]
}

const FRONTMATTER_FENCE = '---'
/** A frontmatter key is a bare YAML scalar key — letters, digits, `_`, `-`. */
const KEY_PATTERN = /^[A-Za-z0-9_-]+$/
/** A YAML block-sequence item: `- value`. */
const LIST_ITEM_PATTERN = /^-\s+(.*)$/

/**
 * Parse a YAML frontmatter block (the `---`-fenced header of a markdown file)
 * into ordered key/value entries for GitHub-style table display.
 *
 * Sequence values become a `string[]` (rendered as chips); scalar values stay
 * a string. Handles block lists (`key:` then `- item` lines), inline arrays
 * (`key: [a, b]`), and flat scalars (`key: value`). Surrounding quotes are
 * stripped and inner colons in scalars are preserved. Non-entry lines (fences,
 * blanks, comments) are skipped.
 */
export function parseFrontmatter(raw: string): FrontmatterEntry[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const entries: FrontmatterEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed === FRONTMATTER_FENCE) continue

    const colon = trimmed.indexOf(':')
    if (colon <= 0) continue

    const key = trimmed.slice(0, colon).trim()
    if (!KEY_PATTERN.test(key)) continue

    const rawValue = trimmed.slice(colon + 1).trim()

    if (rawValue === '') {
      const { items, nextIndex } = consumeListItems(lines, i + 1)
      entries.push({ key, value: items.length > 0 ? items : '' })
      i = nextIndex - 1
      continue
    }

    if (isInlineArray(rawValue)) {
      entries.push({ key, value: parseInlineArray(rawValue) })
      continue
    }

    entries.push({ key, value: stripQuotes(rawValue) })
  }

  return entries
}

/** Collect contiguous `- item` lines starting at `start` into a list. */
function consumeListItems(lines: string[], start: number): { items: string[]; nextIndex: number } {
  const items: string[] = []
  let i = start
  for (; i < lines.length; i++) {
    const match = lines[i].trim().match(LIST_ITEM_PATTERN)
    if (!match) break
    items.push(stripQuotes(match[1].trim()))
  }
  return { items, nextIndex: i }
}

function isInlineArray(value: string): boolean {
  return value.startsWith('[') && value.endsWith(']')
}

function parseInlineArray(value: string): string[] {
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter((item) => item !== '')
}

function stripQuotes(value: string): string {
  if (value.length < 2) return value
  const first = value[0]
  const last = value[value.length - 1]
  const quoted = (first === '"' && last === '"') || (first === "'" && last === "'")
  return quoted ? value.slice(1, -1) : value
}
