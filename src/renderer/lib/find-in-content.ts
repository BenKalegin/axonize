// Browser-style find-in-content over rendered markdown, scoped to a container.
// Uses the CSS Custom Highlight API so the DOM is never mutated — highlights
// survive React re-renders and clear without leaving artifacts.

const ALL_MATCHES_HIGHLIGHT = 'find-match'
const ACTIVE_MATCH_HIGHLIGHT = 'find-match-active'
// Cap so a one-letter query on a huge document stays responsive.
export const MAX_FIND_MATCHES = 500

// The find bar lives inside the searched container; its own text never matches.
const FIND_BAR_CLASS = 'find-in-file-bar'

export function findMatchRanges(container: HTMLElement, query: string): Range[] {
  const needle = query.toLowerCase()
  if (!needle) return []
  const ranges: Range[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(`.${FIND_BAR_CLASS}`)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  })
  while (ranges.length < MAX_FIND_MATCHES) {
    const node = walker.nextNode() as Text | null
    if (!node) break
    const haystack = node.data.toLowerCase()
    let from = 0
    while (ranges.length < MAX_FIND_MATCHES) {
      const at = haystack.indexOf(needle, from)
      if (at === -1) break
      const range = new Range()
      range.setStart(node, at)
      range.setEnd(node, at + needle.length)
      ranges.push(range)
      from = at + needle.length
    }
  }
  return ranges
}

export function applyFindHighlights(ranges: Range[], activeIndex: number): void {
  CSS.highlights.set(ALL_MATCHES_HIGHLIGHT, new Highlight(...ranges))
  const active = ranges[activeIndex]
  if (active) CSS.highlights.set(ACTIVE_MATCH_HIGHLIGHT, new Highlight(active))
  else CSS.highlights.delete(ACTIVE_MATCH_HIGHLIGHT)
}

export function clearFindHighlights(): void {
  CSS.highlights.delete(ALL_MATCHES_HIGHLIGHT)
  CSS.highlights.delete(ACTIVE_MATCH_HIGHLIGHT)
}

export function scrollToMatch(range: Range): void {
  const el = range.startContainer.parentElement
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
