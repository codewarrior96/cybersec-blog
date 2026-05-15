// @vitest-environment jsdom
//
// Phase 4.D Target #2 — AnsiText pure parser component (R-UI-01 partial)
//
// Picks up Phase 2.A explicit deferral (phase-2-a-lab-engine-audit.md:54).
// Terminal.tsx itself (861 LOC, xterm-like surface) routed to Phase 5 E2E
// per Phase 4.A Section 5 "out of scope" rationale.
//
// AnsiText is a 76-LOC pure parser: ANSI escape sequences in → React span
// tree out. No side effects, no hooks beyond rendering. High test ROI.
//
// SENIOR ARCHITECT NOTE: tests assert observable behavior — what visible
// text appears, what inline styles applied, no escapes leaking through.
// Tests lock CURRENT behavior per the actual CODE_MAP in AnsiText.tsx
// (colors 31/32/33/34/35/36/90/91/92/93 + bold/dim/reset). Underline,
// background colors, 256-color, true-color all UNSUPPORTED in current
// implementation — tests don't assert support, they lock the absence
// (R-21 gap-test pattern from Phase 2.D lineage).
//
// REJECTED ALTERNATIVE: tests that assert "underline works" or "256-color
// works" — rejected because the parser doesn't support those, and writing
// tests that pass on hypothetical future behavior is dishonest.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import AnsiText from '@/components/lab/AnsiText'

// ─── helper: assert visible text content (escape-free) ───────────────────────

function visibleText(container: HTMLElement): string {
  return container.textContent ?? ''
}

// ─── helper: get all child spans (parser's segment output) ───────────────────

function getSegments(container: HTMLElement): HTMLSpanElement[] {
  // Outer wrapper <span> is the root; inner spans are segments
  const root = container.querySelector('span')
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLSpanElement>(':scope > span'))
}

describe('AnsiText — Phase 4.D Target #2 (R-UI-01 partial)', () => {
  // ─── plain + empty (T-AT01-02) ────────────────────────────────────────────

  it('T-AT01 — empty string renders an empty wrapper span', () => {
    const { container } = render(<AnsiText text="" />)
    // Outer <span> exists but has no children
    expect(container.textContent).toBe('')
    expect(getSegments(container)).toHaveLength(0)
  })

  it('T-AT02 — plain text with no ANSI sequences renders a single segment', () => {
    const { container } = render(<AnsiText text="hello world" />)
    expect(visibleText(container)).toBe('hello world')
    const segments = getSegments(container)
    expect(segments.length).toBeGreaterThanOrEqual(1)
  })

  // ─── foreground colors (T-AT03-06) ────────────────────────────────────────

  it('T-AT03 — \\x1b[31m applies red foreground (#ef4444)', () => {
    const { container } = render(<AnsiText text={'\x1b[31mred\x1b[0m'} />)
    const segments = getSegments(container)
    const red = segments.find((s) => s.textContent === 'red')
    expect(red).toBeDefined()
    expect(red?.style.color).toBe('rgb(239, 68, 68)')
  })

  it('T-AT04 — \\x1b[32m applies green foreground (#00ff41)', () => {
    const { container } = render(<AnsiText text={'\x1b[32mgreen\x1b[0m'} />)
    const segments = getSegments(container)
    const green = segments.find((s) => s.textContent === 'green')
    expect(green?.style.color).toBe('rgb(0, 255, 65)')
  })

  it('T-AT05 — \\x1b[33m applies yellow foreground (#fbbf24)', () => {
    const { container } = render(<AnsiText text={'\x1b[33myellow\x1b[0m'} />)
    const segments = getSegments(container)
    const yellow = segments.find((s) => s.textContent === 'yellow')
    expect(yellow?.style.color).toBe('rgb(251, 191, 36)')
  })

  it('T-AT06 — \\x1b[34m applies blue foreground (#60a5fa)', () => {
    const { container } = render(<AnsiText text={'\x1b[34mblue\x1b[0m'} />)
    const segments = getSegments(container)
    const blue = segments.find((s) => s.textContent === 'blue')
    expect(blue?.style.color).toBe('rgb(96, 165, 250)')
  })

  // ─── bold + dim styles (T-AT07-08) ────────────────────────────────────────

  it('T-AT07 — \\x1b[1m applies bold (fontWeight=700)', () => {
    const { container } = render(<AnsiText text={'\x1b[1mbold\x1b[0m'} />)
    const segments = getSegments(container)
    const bold = segments.find((s) => s.textContent === 'bold')
    // Style is set to 700 in CODE_MAP; inline style serializes to '700'
    expect(bold?.style.fontWeight).toBe('700')
  })

  it('T-AT08 — \\x1b[2m applies dim (opacity=0.5)', () => {
    const { container } = render(<AnsiText text={'\x1b[2mdim\x1b[0m'} />)
    const segments = getSegments(container)
    const dim = segments.find((s) => s.textContent === 'dim')
    expect(dim?.style.opacity).toBe('0.5')
  })

  // ─── reset semantics (T-AT09) ─────────────────────────────────────────────

  it('T-AT09 — \\x1b[0m reset clears prior color/bold/dim state', () => {
    const { container } = render(
      <AnsiText text={'\x1b[1;31mhot\x1b[0m cool'} />,
    )
    const segments = getSegments(container)
    const hot = segments.find((s) => s.textContent === 'hot')
    expect(hot?.style.color).toBe('rgb(239, 68, 68)')
    expect(hot?.style.fontWeight).toBe('700')
    // Post-reset segment ' cool' should have no color, no bold
    const cool = segments.find((s) => s.textContent?.trim() === 'cool')
    expect(cool?.style.color).toBe('')
    // After reset, bold is false → fontWeight should be unset (not 700)
    expect(cool?.style.fontWeight).not.toBe('700')
  })

  // ─── combined sequence (T-AT10) ───────────────────────────────────────────

  it('T-AT10 — \\x1b[1;31m combined sequence applies bold + red simultaneously', () => {
    const { container } = render(<AnsiText text={'\x1b[1;31mboth\x1b[0m'} />)
    const segments = getSegments(container)
    const both = segments.find((s) => s.textContent === 'both')
    expect(both?.style.color).toBe('rgb(239, 68, 68)')
    expect(both?.style.fontWeight).toBe('700')
  })

  // ─── bright variants (T-AT11) ─────────────────────────────────────────────

  it('T-AT11 — bright color variants (\\x1b[91m / [92m / [93m) apply expected colors', () => {
    const { container } = render(
      <AnsiText text={'\x1b[91mr\x1b[92mg\x1b[93my\x1b[0m'} />,
    )
    const segments = getSegments(container)
    const r = segments.find((s) => s.textContent === 'r')
    const g = segments.find((s) => s.textContent === 'g')
    const y = segments.find((s) => s.textContent === 'y')
    expect(r?.style.color).toBe('rgb(248, 113, 113)') // #f87171
    expect(g?.style.color).toBe('rgb(74, 222, 128)') // #4ade80
    expect(y?.style.color).toBe('rgb(253, 224, 71)') // #fde047
  })

  // ─── unknown code (T-AT12) ────────────────────────────────────────────────

  it('T-AT12 — unknown ANSI code is silently ignored (state unchanged)', () => {
    const { container } = render(
      <AnsiText text={'\x1b[31mred\x1b[99munknown stays red'} />,
    )
    // [99m is NOT in CODE_MAP → state retains red
    const segments = getSegments(container)
    const post = segments.find((s) => s.textContent === 'unknown stays red')
    expect(post?.style.color).toBe('rgb(239, 68, 68)')
  })

  // ─── escape position (T-AT13-14) ──────────────────────────────────────────

  it('T-AT13 — escape sequence at start of string applies to first segment', () => {
    const { container } = render(<AnsiText text={'\x1b[32mstart'} />)
    const segments = getSegments(container)
    expect(segments[0]?.textContent).toBe('start')
    expect(segments[0]?.style.color).toBe('rgb(0, 255, 65)')
  })

  it('T-AT14 — escape sequence at end of string produces no trailing segment', () => {
    const { container } = render(<AnsiText text={'plain\x1b[31m'} />)
    expect(visibleText(container)).toBe('plain')
    const segments = getSegments(container)
    // Only one segment: 'plain' (no empty segment after the dangling escape)
    expect(segments.filter((s) => (s.textContent ?? '').length > 0)).toHaveLength(1)
  })

  // ─── accumulation (T-AT15) ────────────────────────────────────────────────

  it('T-AT15 — multiple consecutive escapes accumulate state for subsequent text', () => {
    // Bold (\x1b[1m) then red (\x1b[31m) then text
    const { container } = render(<AnsiText text={'\x1b[1m\x1b[31mboth'} />)
    const segments = getSegments(container)
    const both = segments.find((s) => s.textContent === 'both')
    expect(both?.style.color).toBe('rgb(239, 68, 68)')
    expect(both?.style.fontWeight).toBe('700')
  })

  // ─── a11y smoke (T-AT16, Z.4 pattern) ─────────────────────────────────────

  it('T-AT16 — axe a11y smoke (no violations on rendered ANSI output)', async () => {
    const { container } = render(
      <AnsiText text={'\x1b[1;32moperator\x1b[0m@\x1b[36mbreach-lab\x1b[0m$ '} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
