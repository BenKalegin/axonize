import { useEffect, useCallback } from 'react'

/**
 * Hook to handle Escape key press
 * @param onEscape - Callback to execute when Escape is pressed
 * @param enabled - Whether the listener is active (default: true)
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape()
      }
    },
    [onEscape]
  )

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}
