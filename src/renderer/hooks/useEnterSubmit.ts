import { KeyboardEvent } from 'react'

/**
 * Hook to handle Enter key submission
 * @param onSubmit - Callback to execute when Enter is pressed
 * @param options - Configuration options
 * @returns Keyboard event handler
 */
export function useEnterSubmit(
  onSubmit: () => void,
  options: {
    preventDefault?: boolean
    allowShiftEnter?: boolean
  } = {}
) {
  const { preventDefault = true, allowShiftEnter = true } = options

  return (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      // If Shift+Enter is allowed and Shift is pressed, don't submit
      if (allowShiftEnter && event.shiftKey) {
        return
      }

      if (preventDefault) {
        event.preventDefault()
      }

      onSubmit()
    }
  }
}
