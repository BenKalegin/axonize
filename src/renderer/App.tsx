import { useEffect } from 'react'
import { Shell } from './components/Shell'
import type { AppSettings } from '@core/rag/types'
import type { ThemeId } from '@core/themes'
import { applyTheme } from '@/lib/theme-applier'

export function App() {
  useEffect(() => {
    // In the E2E browser harness window.axonize is unbridged, and during dev a
    // restart-lag can briefly leave it undefined too. Skip theme load in that
    // case — the default theme is already applied via CSS.
    if (!window.axonize) return
    window.axonize.settings.get().then((s) => {
      const settings = s as AppSettings
      if (settings.appearance?.themeId) {
        applyTheme(settings.appearance.themeId as ThemeId)
      }
    })
  }, [])

  return <Shell />
}
