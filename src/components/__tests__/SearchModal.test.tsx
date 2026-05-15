// @vitest-environment jsdom
//
// Phase 4.D Target #3 — SearchModal (R-UI-02 transitive + filter + keyboard)
//
// Combines the useFocusTrap integration (Target #1 transitive) with own
// surface: Cmd-K / Ctrl-K toggle, Escape close, backdrop click, filter
// logic, auto-focus on open.
//
// SENIOR ARCHITECT NOTE: SearchModal is internally state-managed (no
// `open` prop); test interactions are keyboard-driven via window keydown
// listener. Tests assert observable behavior — what renders, what closes,
// what filters — never internal state.
//
// REJECTED ALTERNATIVE: mock useFocusTrap. Rejected — testing
// SearchModal's INTEGRATION with the hook is the point of Target #3;
// mocking would turn an integration test into a unit test and lose
// the wiring coverage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import SearchModal from '@/components/SearchModal'
import type { PostMeta } from '@/lib/posts'

// ─── fixtures ────────────────────────────────────────────────────────────────

// SENIOR ARCHITECT NOTE: fixture matches actual PostMeta shape from
// src/lib/posts.ts L12-19: { slug, title, date, description?, tags?,
// readingTime? }. No `excerpt`, no `author` (those would fail tsc).
const POSTS: PostMeta[] = [
  {
    slug: 'sql-injection-temelleri',
    title: 'SQL Injection Temelleri',
    date: '2025-01-01',
    tags: ['sql', 'web'],
    readingTime: 5,
  },
  {
    slug: 'reverse-shell-teknikleri',
    title: 'Reverse Shell Teknikleri',
    date: '2025-01-02',
    tags: ['shell', 'linux'],
    readingTime: 8,
  },
  {
    slug: 'xss-tehlikeleri',
    title: 'XSS Tehlikeleri',
    date: '2025-01-03',
    tags: ['web', 'xss'],
    readingTime: 4,
  },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function openModal() {
  // Cmd/Ctrl+K toggles the modal — fire on window for the listener
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
}

function closeViaEscape() {
  fireEvent.keyDown(window, { key: 'Escape' })
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('SearchModal — Phase 4.D Target #3 (R-UI-02 transitive + filter + keyboard)', () => {
  // jsdom offsetParent patch — same rationale as useFocusTrap tests:
  // jsdom returns null for unpositioned elements, causing focus-trap
  // logic to filter out all focusables. Patch to mirror real-browser
  // behavior (null only when display:none).
  let originalOffsetParent: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOffsetParent = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetParent',
    )
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        let el: HTMLElement | null = this
        while (el) {
          if (el.style.display === 'none') return null
          el = el.parentElement
        }
        return this.parentElement
      },
    })
  })

  afterEach(() => {
    if (originalOffsetParent) {
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent)
    }
    vi.useRealTimers()
  })

  it('T-SM01 — initial render is closed (returns null, nothing in DOM)', () => {
    const { container } = render(<SearchModal posts={POSTS} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('T-SM02 — opens on Ctrl+K (renders dialog)', () => {
    render(<SearchModal posts={POSTS} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    openModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('T-SM03 — opens on Meta+K (Cmd-K on macOS)', () => {
    render(<SearchModal posts={POSTS} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('T-SM04 — Escape key closes the modal', () => {
    render(<SearchModal posts={POSTS} />)
    openModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    closeViaEscape()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('T-SM05 — backdrop click closes the modal (outer div onClick)', async () => {
    const user = userEvent.setup()
    render(<SearchModal posts={POSTS} />)
    openModal()
    const dialog = screen.getByRole('dialog')
    // Outer dialog div has onClick={() => setOpen(false)}
    await user.click(dialog)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('T-SM06 — inner content click does NOT close (stopPropagation)', async () => {
    const user = userEvent.setup()
    render(<SearchModal posts={POSTS} />)
    openModal()
    // Input is inside the inner content wrapper which calls stopPropagation
    const input = screen.getByPlaceholderText(/başlık veya etiket ara/i)
    await user.click(input)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('T-SM07 — input is focused after open (via useFocusTrap + 50ms safety timer)', () => {
    // SENIOR ARCHITECT NOTE: SearchModal focuses the input via TWO paths:
    //   1. useFocusTrap activates on open → moves focus to first focusable
    //      (the input) synchronously after mount.
    //   2. A 50ms setTimeout (component lines 28-34) re-focuses the input
    //      as a safety belt-and-suspenders.
    // Both paths converge to the same observable: input has focus once the
    // modal is open. We test the convergent state, not the internal
    // ordering of the two focus calls (implementation detail).
    vi.useFakeTimers()
    render(<SearchModal posts={POSTS} />)
    openModal()
    const input = screen.getByPlaceholderText(/başlık veya etiket ara/i)
    // Advance past the 50ms timer to ensure both focus paths have fired
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(document.activeElement).toBe(input)
  })

  it('T-SM08 — empty query shows first 8 posts (or all if less than 8)', () => {
    render(<SearchModal posts={POSTS} />)
    openModal()
    // 3 posts in fixture; all 3 should appear
    expect(screen.getByText('SQL Injection Temelleri')).toBeInTheDocument()
    expect(screen.getByText('Reverse Shell Teknikleri')).toBeInTheDocument()
    expect(screen.getByText('XSS Tehlikeleri')).toBeInTheDocument()
  })

  it('T-SM09 — typing filters results by title (case-insensitive)', async () => {
    const user = userEvent.setup()
    render(<SearchModal posts={POSTS} />)
    openModal()
    const input = screen.getByPlaceholderText(/başlık veya etiket ara/i)
    await user.type(input, 'reverse')
    expect(screen.queryByText('SQL Injection Temelleri')).toBeNull()
    expect(screen.getByText('Reverse Shell Teknikleri')).toBeInTheDocument()
    expect(screen.queryByText('XSS Tehlikeleri')).toBeNull()
  })

  it('T-SM10 — typing filters results by tag (case-insensitive)', async () => {
    const user = userEvent.setup()
    render(<SearchModal posts={POSTS} />)
    openModal()
    const input = screen.getByPlaceholderText(/başlık veya etiket ara/i)
    await user.type(input, 'xss')
    // XSS post has tag 'xss', should appear. SQL post has tags ['sql', 'web']
    // — neither matches 'xss', so it's filtered out.
    expect(screen.getByText('XSS Tehlikeleri')).toBeInTheDocument()
    expect(screen.queryByText('SQL Injection Temelleri')).toBeNull()
  })

  it('T-SM11 — no match shows "sonuç bulunamadı" message', async () => {
    const user = userEvent.setup()
    render(<SearchModal posts={POSTS} />)
    openModal()
    const input = screen.getByPlaceholderText(/başlık veya etiket ara/i)
    await user.type(input, 'zzzzzzz-no-match')
    expect(screen.getByText(/sonuç bulunamadı/i)).toBeInTheDocument()
  })

  it('T-SM12 — axe a11y smoke (no violations on open dialog)', async () => {
    const { container } = render(<SearchModal posts={POSTS} />)
    openModal()
    expect(await axe(container)).toHaveNoViolations()
  })
})
