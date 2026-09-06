export const DiffLineKind = {
  context: 'context',
  added: 'added',
  removed: 'removed'
} as const
export type DiffLineKind = (typeof DiffLineKind)[keyof typeof DiffLineKind]

export interface DiffSegment {
  kind: DiffLineKind
  lines: string[]
}

export interface DiffStats {
  added: number
  removed: number
}

// Context lines kept on each side of a change when collapsing for display.
const DISPLAY_CONTEXT_LINES = 3

/**
 * Myers O(ND) greedy line diff. Returns consecutive same-kind segments in
 * document order; within each change block removals precede additions.
 */
export function diffLines(before: string, after: string): DiffSegment[] {
  const a = before.split('\n')
  const b = after.split('\n')
  return normalizeChangeBlocks(movesToSegments(a, b, myersMoves(a, b)))
}

export function diffStats(segments: DiffSegment[]): DiffStats {
  let added = 0
  let removed = 0
  for (const s of segments) {
    if (s.kind === DiffLineKind.added) added += s.lines.length
    if (s.kind === DiffLineKind.removed) removed += s.lines.length
  }
  return { added, removed }
}

export function hasChanges(segments: DiffSegment[]): boolean {
  return segments.some((s) => s.kind !== DiffLineKind.context)
}

/**
 * Collapse long context runs for display: keep DISPLAY_CONTEXT_LINES lines of
 * context adjacent to each change and drop the middle. A dropped run becomes a
 * `null` entry so renderers can show a separator.
 */
export function collapseContext(segments: DiffSegment[]): (DiffSegment | null)[] {
  const out: (DiffSegment | null)[] = []
  segments.forEach((seg, i) => {
    if (seg.kind !== DiffLineKind.context) {
      out.push(seg)
      return
    }
    const keepBefore = i === 0 ? 0 : DISPLAY_CONTEXT_LINES
    const keepAfter = i === segments.length - 1 ? 0 : DISPLAY_CONTEXT_LINES
    if (seg.lines.length <= keepBefore + keepAfter) {
      out.push(seg)
      return
    }
    if (keepBefore > 0) out.push({ kind: DiffLineKind.context, lines: seg.lines.slice(0, keepBefore) })
    out.push(null)
    if (keepAfter > 0) out.push({ kind: DiffLineKind.context, lines: seg.lines.slice(-keepAfter) })
  })
  return out
}

type Move = 'diag' | 'down' | 'right'

function myersMoves(a: string[], b: string[]): Move[] {
  const n = a.length
  const m = b.length
  const max = n + m
  const offset = max
  const v = new Array<number>(2 * max + 1).fill(0)
  const traceV: number[][] = []

  outer: for (let d = 0; d <= max; d++) {
    traceV.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1]
          : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) { x++; y++ }
      v[offset + k] = x
      if (x >= n && y >= m) break outer
    }
  }

  return backtrackMoves(a.length, b.length, traceV, offset)
}

function backtrackMoves(xEnd: number, yEnd: number, traceV: number[][], offset: number): Move[] {
  const moves: Move[] = []
  let x = xEnd
  let y = yEnd
  for (let d = traceV.length - 1; d > 0 && (x > 0 || y > 0); d--) {
    const v = traceV[d]
    const k = x - y
    const downwards = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
    const prevK = downwards ? k + 1 : k - 1
    const prevX = v[offset + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { moves.push('diag'); x--; y-- }
    if (downwards) { moves.push('down'); y-- }
    else { moves.push('right'); x-- }
  }
  while (x > 0 && y > 0) { moves.push('diag'); x--; y-- }
  while (x > 0) { moves.push('right'); x-- }
  while (y > 0) { moves.push('down'); y-- }
  return moves.reverse()
}

const MOVE_KIND: Record<Move, DiffLineKind> = {
  diag: DiffLineKind.context,
  right: DiffLineKind.removed,
  down: DiffLineKind.added
}

function movesToSegments(a: string[], b: string[], moves: Move[]): DiffSegment[] {
  const segments: DiffSegment[] = []
  let x = 0
  let y = 0
  for (const move of moves) {
    const line = move === 'down' ? b[y] : a[x]
    if (move !== 'down') x++
    if (move !== 'right') y++
    const kind = MOVE_KIND[move]
    const last = segments[segments.length - 1]
    if (last && last.kind === kind) last.lines.push(line)
    else segments.push({ kind, lines: [line] })
  }
  return segments
}

/** Within each run of non-context segments, order removals before additions. */
function normalizeChangeBlocks(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = []
  let block: DiffSegment[] = []
  const flush = (): void => {
    if (block.length === 0) return
    const removed = block.filter((s) => s.kind === DiffLineKind.removed).flatMap((s) => s.lines)
    const added = block.filter((s) => s.kind === DiffLineKind.added).flatMap((s) => s.lines)
    if (removed.length > 0) out.push({ kind: DiffLineKind.removed, lines: removed })
    if (added.length > 0) out.push({ kind: DiffLineKind.added, lines: added })
    block = []
  }
  for (const seg of segments) {
    if (seg.kind === DiffLineKind.context) {
      flush()
      out.push(seg)
    } else {
      block.push(seg)
    }
  }
  flush()
  return out
}
