import { useEffect } from 'react'
import { Shell } from './components/Shell'
import type { AppSettings } from '@core/rag/types'
import type { ThemeId } from '@core/themes'
import { applyTheme } from '@/lib/theme-applier'

export function App() {
  useEffect(() => {
    window.axonize.settings.get().then((s) => {
      const settings = s as AppSettings
      if (settings.appearance?.themeId) {
        applyTheme(settings.appearance.themeId as ThemeId)
      }
    })
  }, [])

  return <Shell />
}
