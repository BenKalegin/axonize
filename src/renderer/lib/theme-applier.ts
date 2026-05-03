import { THEMES, DEFAULT_THEME_ID, type ThemeId, type ThemeMeta, type ThemeColors } from '@core/themes'

/** CSS custom property name for each ThemeColors key. */
const COLOR_TO_CSS_VAR: Record<keyof ThemeColors, string> = {
  bgBase: '--bg-base',
  bgSurface: '--bg-surface',
  bgOverlay: '--bg-overlay',
  bgMuted: '--bg-muted',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  accent: '--accent',
  accentHover: '--accent-hover',
  green: '--green',
  red: '--red',
  yellow: '--yellow',
  border: '--border',
  scrollbarBg: '--scrollbar-bg',
  scrollbarThumb: '--scrollbar-thumb',
}

let _activeTheme: ThemeMeta = THEMES.find((t) => t.id === DEFAULT_THEME_ID)!

/** Returns the currently active theme metadata. */
export function getActiveTheme(): ThemeMeta {
  return _activeTheme
}

/**
 * Apply a theme by setting CSS custom properties on `<html>`.
 * Falls back to the default theme when the given id is not found.
 */
export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)
  if (!theme) return

  _activeTheme = theme

  const root = document.documentElement
  const keys = Object.keys(COLOR_TO_CSS_VAR) as Array<keyof ThemeColors>
  for (const key of keys) {
    root.style.setProperty(COLOR_TO_CSS_VAR[key], theme.colors[key])
  }

  // Derived variable: bg-elevated sits between overlay and surface
  root.style.setProperty('--bg-elevated', theme.colors.bgOverlay)
}
