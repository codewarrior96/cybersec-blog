// @vitest-environment jsdom
//
// Phase 4.D Target #1 — useFocusTrap hook (R-UI-02 closure)
//
// Single 76-LOC primitive (src/hooks/useFocusTrap.ts) gates focus
// management across 5 modal surfaces:
//   - NavigationBar drawer
//   - AttackReportModal (dashboard)
//   - CriticalAlertPanel (dashboard)
//   - SearchModal (global)
//   - DeleteAccountModal (portfolio)
//
// One hook test → transitive coverage for all 5 consumers. Highest
// test ROI of Phase 4.D scope.
//
// SENIOR ARCHITECT NOTE: tests assert observable behavior — what
// receives focus, when Escape fires the callback, where focus
// returns on cleanup. NO assertions on hook's internal state, ref
// internals, or implementation details. Refactor-safe.
//
// REJECTED ALTERNATIVE: mock document.activeElement / focus(). Rejected
// — jsdom provides real focus tracking; mocking would test the mock
// not the hook. Real focus semantics are the whole point.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// SENIOR ARCHITECT NOTE: Tab navigation tests use fireEvent.keyDown
// rather than userEvent.tab() — user-event v14 has its own internal
// focus advancement logic that races with the hook's preventDefault.
// fireEvent.keyDown dispatches a raw keydown event without doing any
// follow-up focus shift, letting the hook's logic execute cleanly.
// We then assert document.activeElement directly. Escape tests use
// userEvent.keyboard since there's no focus race involved.
// REJECTED ALTERNATIVE: manually fire keydown + then focus the next
// element ourselves. Rejected — that tests our test scaffold, not
// the hook's behavior.
const tabKey = (shift = false) =>
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: shift })

// ─── Test harness ────────────────────────────────────────────────────────────

/**
 * Renders a container with N buttons, optionally a hidden button, optionally
 * a disabled button, optionally a tabindex=-1 button, and applies the hook.
 *
 * SENIOR ARCHITECT NOTE: a single configurable harness keeps test code
 * focused on the assertion under test, not the scaffolding. Each test
 * exercises a different combination via props.
 */
interface HarnessProps {
  active: boolean
  onEscape?: () => void
  buttons?: number
  includeHidden?: boolean
  includeDisabled?: boolean
  includeNegativeTabindex?: boolean
}

function TrapHarness({
  active,
  onEscape,
  buttons = 3,
  includeHidden = false,
  includeDisabled = false,
  includeNegativeTabindex = false,
}: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(active, containerRef, onEscape)

  return (
    <>
      <button type="button" data-testid="outside-before">outside before</button>
      <div ref={containerRef} data-testid="trap-container">
        {Array.from({ length: buttons }).map((_, i) => (
          <button key={i} type="button" data-testid={`btn-${i}`}>
            btn {i}
          </button>
        ))}
        {includeDisabled && (
          <button type="button" disabled data-testid="btn-disabled">
            disabled
          </button>
        )}
        {includeNegativeTabindex && (
          // SENIOR ARCHITECT NOTE: this is a <div>, NOT a <button>, because
          // the FOCUSABLE_SELECTOR clause `[tabindex]:not([tabindex="-1"])`
          // only filters elements matched via the [tabindex] branch.
          // Native focusables (button/a/input) match their own clause
          // (e.g., `button:not([disabled])`) regardless of tabindex. So a
          // `<button tabindex=-1>` is STILL included in focusables — that's
          // current hook behavior. A `<div tabindex=-1>` is correctly excluded.
          // R-21 gap-test note: the asymmetry is intentional in the hook
          // (native focusables are always tab targets unless explicitly
          // disabled); not in scope to "fix" here.
          <div tabIndex={-1} data-testid="div-negative-tabindex">
            negative tabindex div
          </div>
        )}
        {includeHidden && (
          // display:none makes offsetParent === null → hook filters it out
          <button type="button" style={{ display: 'none' }} data-testid="btn-hidden">
            hidden
          </button>
        )}
      </div>
      <button type="button" data-testid="outside-after">outside after</button>
    </>
  )
}

describe('useFocusTrap — Phase 4.D Target #1 (R-UI-02 closure)', () => {
  // SENIOR ARCHITECT NOTE: jsdom does not implement CSS layout, so
  // HTMLElement.offsetParent returns null for unpositioned elements
  // even when they're visible. The hook (L48) filters by
  // `el.offsetParent !== null` to exclude truly-hidden (display:none)
  // elements in a real browser. To test the hook's wrap logic without
  // false negatives from jsdom layout gaps, we patch offsetParent to
  // return `parentElement` by default, and let display:none elements
  // still report null (jsdom does honor display:none for offsetParent).
  // REJECTED ALTERNATIVE: refactor hook to use a different visibility
  // check. Rejected — yasaklar says no product code changes; we adapt
  // the test to the production code, not the other way around.
  let originalOffsetParent: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOffsetParent = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetParent',
    )
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        // Mirror real-browser behavior: null if display:none on self or ancestor
        let el: HTMLElement | null = this
        while (el) {
          if (el.style.display === 'none') return null
          el = el.parentElement
        }
        return this.parentElement
      },
    })
    document.body.focus()
  })

  afterEach(() => {
    if (originalOffsetParent) {
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent)
    } else {
      // No original descriptor — remove our override
      delete (HTMLElement.prototype as unknown as { offsetParent?: unknown }).offsetParent
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  it('T-FT01 — initial focus moves to first focusable when active becomes true', () => {
    render(<TrapHarness active={true} />)
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
  })

  it('T-FT02 — Tab on last focusable wraps to first (forward boundary)', () => {
    render(<TrapHarness active={true} buttons={3} />)
    // Focus last
    const last = screen.getByTestId('btn-2')
    last.focus()
    expect(document.activeElement).toBe(last)
    // Raw Tab keydown → hook intercepts, calls first.focus()
    tabKey()
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
  })

  it('T-FT03 — Shift+Tab on first focusable wraps to last (backward boundary)', () => {
    render(<TrapHarness active={true} buttons={3} />)
    // Initial focus is btn-0; Shift+Tab → hook wraps to last
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
    tabKey(true)
    expect(document.activeElement).toBe(screen.getByTestId('btn-2'))
  })

  it('T-FT04 — Tab on container with zero focusable elements does not throw', () => {
    render(<TrapHarness active={true} buttons={0} />)
    // No focusables; hook should preventDefault on Tab + not throw
    expect(() => tabKey()).not.toThrow()
    // Focus stays wherever it was — hook doesn't crash
    expect(document.activeElement).not.toBeNull()
  })

  it('T-FT05 — Escape key invokes onEscape callback when provided', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn()
    render(<TrapHarness active={true} onEscape={onEscape} />)
    await user.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('T-FT06 — Escape with no onEscape provided does not throw', async () => {
    const user = userEvent.setup()
    render(<TrapHarness active={true} />)
    // No onEscape callback wired; Escape should be a no-op (not throw)
    await expect(user.keyboard('{Escape}')).resolves.not.toThrow()
  })

  it('T-FT07 — focus restored to previously focused element on deactivation', () => {
    // Render with active=false first so outside button can be focused
    const { rerender } = render(<TrapHarness active={false} />)
    const outsideBefore = screen.getByTestId('outside-before')
    outsideBefore.focus()
    expect(document.activeElement).toBe(outsideBefore)
    // Activate trap → focus moves into trap
    rerender(<TrapHarness active={true} />)
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
    // Deactivate → focus should restore to outsideBefore
    rerender(<TrapHarness active={false} />)
    expect(document.activeElement).toBe(outsideBefore)
  })

  it('T-FT08 — disabled elements excluded from wrap target (last → first)', () => {
    // SENIOR ARCHITECT NOTE: hook filters disabled/hidden/tabindex=-1 ONLY
    // for wrap-target computation (first/last in `focusables` list).
    // Interior tab navigation is browser-default and out of hook's
    // control. So we test the WRAP CONTRACT: when wrapping from last
    // to first, the disabled element must not be the wrap target.
    render(<TrapHarness active={true} buttons={2} includeDisabled={true} />)
    // DOM order: btn-0, btn-1, btn-disabled. focusables filter excludes
    // disabled → list = [btn-0, btn-1]. last = btn-1.
    const last = screen.getByTestId('btn-1')
    last.focus()
    expect(document.activeElement).toBe(last)
    tabKey()
    // Wrap target is btn-0 (first non-disabled), NOT btn-disabled
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
    expect(document.activeElement).not.toBe(screen.getByTestId('btn-disabled'))
  })

  it('T-FT09 — [tabindex=-1] on non-native focusable (div) excluded from wrap target', () => {
    // SENIOR ARCHITECT NOTE: FOCUSABLE_SELECTOR clause
    // `[tabindex]:not([tabindex="-1"])` filters elements matched via
    // their [tabindex] attribute (e.g., a <div tabindex="0"> that's
    // explicitly made focusable). A <div tabindex="-1"> must NOT
    // appear as a wrap target. Native focusables (button/a/input)
    // are matched via their own selector clause and are NOT affected
    // by the tabindex filter — that's an intentional asymmetry (a
    // <button tabindex="-1"> is still considered tab-target by the
    // hook). R-21 gap-test pattern locks current behavior.
    render(<TrapHarness active={true} buttons={2} includeNegativeTabindex={true} />)
    const last = screen.getByTestId('btn-1')
    last.focus()
    tabKey()
    // Wrap target is btn-0; div-negative-tabindex skipped by selector
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
    expect(document.activeElement).not.toBe(screen.getByTestId('div-negative-tabindex'))
  })

  it('T-FT10 — display:none elements excluded from wrap target (offsetParent filter)', () => {
    // SENIOR ARCHITECT NOTE: hook L48 filters elements with
    // offsetParent === null. display:none reliably gives offsetParent
    // === null in jsdom. The wrap target must skip the hidden button.
    render(<TrapHarness active={true} buttons={2} includeHidden={true} />)
    const last = screen.getByTestId('btn-1')
    last.focus()
    tabKey()
    // Wrap target is btn-0, NOT btn-hidden
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
    expect(document.activeElement).not.toBe(screen.getByTestId('btn-hidden'))
  })

  it('T-FT11 — hook deactivates cleanly when active flips false → true → false', () => {
    const { rerender } = render(<TrapHarness active={false} />)
    const outsideBefore = screen.getByTestId('outside-before')
    outsideBefore.focus()
    // Activate
    rerender(<TrapHarness active={true} />)
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
    // Deactivate
    rerender(<TrapHarness active={false} />)
    expect(document.activeElement).toBe(outsideBefore)
    // Re-activate — should work again
    rerender(<TrapHarness active={true} />)
    expect(document.activeElement).toBe(screen.getByTestId('btn-0'))
  })

  it('T-FT12 — Tab handler unbound on unmount (no effect after unmount)', async () => {
    const user = userEvent.setup()
    const onEscape = vi.fn()
    const { unmount } = render(<TrapHarness active={true} onEscape={onEscape} />)
    // Unmount → cleanup should remove keydown listener
    unmount()
    // Escape after unmount should NOT call onEscape
    await user.keyboard('{Escape}')
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('T-FT13 — onEscape preventDefault: Escape does not propagate when handled', async () => {
    // Lock the contract: hook calls event.preventDefault() before onEscape.
    // Verifies the hook is a "real" stop, not just a passthrough.
    const onEscape = vi.fn()
    render(<TrapHarness active={true} onEscape={onEscape} />)
    const handled = vi.fn()
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.defaultPrevented) handled()
    })
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(handled).toHaveBeenCalledTimes(1)
  })
})
