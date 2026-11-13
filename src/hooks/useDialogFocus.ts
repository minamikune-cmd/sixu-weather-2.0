import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared dialog behaviour: locks body scroll, focuses the first focusable
 * element on open (or `focusSelector` if provided), traps Tab/Shift-Tab
 * inside the dialog, closes on Escape, and restores focus to the triggering
 * element on close.
 *
 * Attach the returned ref to the element with `role="dialog"`.
 */
export function useDialogFocus(open: boolean, onClose: () => void, focusSelector?: string) {
  const dialogRef = useRef<HTMLElement>(null)
  const restoreRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    restoreRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const target = (focusSelector ? dialog?.querySelector<HTMLElement>(focusSelector) : null)
        ?? dialog?.querySelector<HTMLElement>(FOCUSABLE)
        ?? dialog
      target?.focus()
    }, 80)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => element.getClientRects().length > 0)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      const restore = restoreRef.current
      if (restore instanceof HTMLElement && document.contains(restore)) restore.focus()
    }
  }, [open, onClose, focusSelector])

  return dialogRef
}
