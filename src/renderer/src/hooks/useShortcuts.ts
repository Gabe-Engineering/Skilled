import { useEffect } from 'react'

/**
 * Renderer-only shortcuts. File/view shortcuts live on the native menu so they
 * are not duplicated here; Ctrl+K opens the link popover in the ribbon.
 */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('skilled:link'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
