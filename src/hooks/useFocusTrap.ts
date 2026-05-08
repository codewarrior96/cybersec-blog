'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Modal accessibility primitive: traps focus inside `containerRef` while
 * `active` is true, optionally closes on Escape, and restores focus to
 * the previously focused element on deactivation.
 *
 * WCAG 2.1 AA — modal pattern (focus management).
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement>,
  onEscape?: () => void,
): void {
  useEffect(() => {
    if (!active) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = containerRef.current
    if (!container) return

    // Focus the first focusable element on activation
    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        onEscape()
        return
      }

      if (event.key !== 'Tab') return

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

      if (focusables.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeEl === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef, onEscape])
}
