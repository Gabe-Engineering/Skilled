import { useEffect } from 'react'

/**
 * Renderer-only shortcuts. File/view shortcuts live on the native menu so they
 * are not duplicated here; Ctrl+K opens the link popover in the ribbon.
 */
/** Ctrl+K belongs to the document, not to the name/description inputs. */
function inEditor(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el?.closest?.('.page-content')
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        if (!inEditor(e.target)) return
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('skilled:link'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
