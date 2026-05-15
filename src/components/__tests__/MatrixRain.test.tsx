// @vitest-environment jsdom
//
// Wave 2A — R-UI-08 closure regression tests for MatrixRain canvas.
//
// MatrixRain is a purely decorative background animation (falling kanji
// + ASCII rain). Phase 4.A audit flagged it as WCAG 1.1.1 surface that
// AT could announce as "canvas" with no context. Wave 2A fix:
// aria-hidden="true" on the canvas element to remove it from the AT
// accessibility tree.
//
// SENIOR ARCHITECT NOTE: tests assert (1) the canvas element exists and
// (2) it carries aria-hidden="true". Axe smoke confirms no a11y rule
// violations on the rendered output. The canvas's animation loop is
// driven by setInterval — vi.useFakeTimers is NOT needed because we
// don't assert frame content (the visual is decoration; the contract
// is "hidden from AT", not "renders X chars").

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import MatrixRain from '@/components/MatrixRain'

describe('MatrixRain — Wave 2A R-UI-08 closure (decorative canvas a11y)', () => {
  // SENIOR ARCHITECT NOTE: MatrixRain's useEffect calls
  // `canvas.getContext('2d')!` — jsdom returns null (no `canvas` npm
  // package installed; Phase 4.B intentionally skipped that dep per
  // R-UI-08 component being decorative). The setInterval callback
  // then dereferences null ctx → "Cannot set properties of null
  // (setting 'fillStyle')".
  //
  // We provide a minimal getContext stub that returns a no-op 2D
  // context. The component's tick() can call fillStyle/fillRect/
  // fillText/globalAlpha/font safely; no rendering happens but no
  // errors are thrown either. This keeps real timers alive (axe needs
  // real setTimeout internally to walk the DOM) AND avoids the
  // null-deref crash.
  //
  // REJECTED ALTERNATIVE 1: install `canvas` npm package. Rejected —
  // ~50MB native dep just for decorative canvas in a jsdom run that
  // never paints pixels.
  // REJECTED ALTERNATIVE 2: vi.useFakeTimers(). Rejected — froze
  // axe's internal setTimeout → 5s timeout. Real timers + no-op ctx
  // is the working combination.
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext
    // The stub returns an object with the small subset of 2D-context
    // properties/methods MatrixRain actually touches. Each property
    // is a getter+setter pair (for `fillStyle`/`globalAlpha`/`font`)
    // or a no-op function (`fillRect`, `fillText`). Casting to
    // `CanvasRenderingContext2D` is safe at the test boundary because
    // we never inspect the returned context's behavior.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: '',
      globalAlpha: 1,
      font: '',
      fillRect: () => {},
      fillText: () => {},
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  it('T-MR01 — renders a canvas element with aria-hidden="true"', () => {
    const { container, unmount } = render(<MatrixRain />)
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.getAttribute('aria-hidden')).toBe('true')
    unmount()
  })

  it('T-MR-A11 — axe smoke: zero a11y violations (canvas correctly hidden from AT)', async () => {
    const { container, unmount } = render(<MatrixRain />)
    expect(await axe(container)).toHaveNoViolations()
    unmount()
  })
})
