// Deterministic default vault icon — colored tile with 2-letter initials.
//
// We hash the vault name into a stable hue so the same vault always looks the
// same in every menu, while different vaults are visually distinguishable at
// the thumbnail size used in the vault popover.

const HUE_BUCKETS = 360
// Match JetBrains' muted, slightly desaturated tile palette — bright primaries
// felt too noisy in a list of 6–10 vaults. Foreground stays white at this
// lightness for ~5:1 contrast against any hue.
const TILE_SATURATION_PCT = 42
const TILE_LIGHTNESS_PCT = 38

export interface DefaultVaultIcon {
  initials: string
  background: string
  foreground: string
}

function hashString(input: string): number {
  // djb2 — small, fast, good enough for color bucketing.
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function deriveInitials(name: string): string {
  const cleaned = name.replace(/[._-]+/g, ' ').trim()
  if (!cleaned) return '··'
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase()
  }
  const single = parts[0]
  return (single.slice(0, 2) || single).toUpperCase()
}

export function defaultVaultIcon(name: string): DefaultVaultIcon {
  const hue = hashString(name) % HUE_BUCKETS
  return {
    initials: deriveInitials(name),
    background: `hsl(${hue} ${TILE_SATURATION_PCT}% ${TILE_LIGHTNESS_PCT}%)`,
    foreground: '#ffffff'
  }
}
