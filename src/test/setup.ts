import { beforeAll, afterEach, afterAll, expect } from 'vitest'
import { server } from './msw/server'
import { __resetAllForTests } from '@/lib/rate-limiter'

// Phase 4.B — DOM testing matchers + a11y matcher registration.
// SENIOR ARCHITECT NOTE: these imports are safe in pure-node test runs.
// @testing-library/jest-dom/vitest only attaches matchers to expect; the
// matchers themselves are no-op until used. vitest-axe matcher exposes
// toHaveNoViolations which Phase 4.D component tests will use.
// REJECTED ALTERNATIVE: gate imports behind typeof window check — adds
// dynamic import complexity for zero runtime savings. Module-load is fine.
import '@testing-library/jest-dom/vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import type { AxeMatchers } from 'vitest-axe/matchers'

expect.extend(axeMatchers)

// SENIOR ARCHITECT NOTE: vitest-axe ships matchers as runtime helpers
// but their types must be augmented onto vitest's Assertion interface
// for tsc to know `expect(...).toHaveNoViolations()` is valid. Without
// this, .test.tsx files using the matcher fail tsc with TS2339.
// REJECTED ALTERNATIVE: per-test-file `// @ts-expect-error` comments —
// silences the error but loses real type checking on the matcher's
// arguments.
// SENIOR ARCHITECT NOTE: Assertion<T = any> matches vitest's own
// declaration at @vitest/expect/dist/index.d.ts:635. Mismatched type
// parameters fail TS2428 "All declarations of 'Assertion' must have
// identical type parameters". `T = any` is the upstream signature.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

// Phase 4.B — RTL cleanup. SENIOR ARCHITECT NOTE: dynamic-import @testing-
// library/react inside afterEach so pure-node tests don't pay the import
// cost. cleanup() is jsdom-only (no-op equivalent in node would throw on
// missing document) so guard with `typeof document !== 'undefined'`.
// REJECTED ALTERNATIVE: top-level import — pulls in DOM-dependent code
// into the 386 node-env tests' setup unnecessarily.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})

// Phase 4.B — Browser API stubs. SENIOR ARCHITECT NOTE: jsdom does not
// natively provide matchMedia / ResizeObserver / IntersectionObserver.
// Components that call these throw at render time without stubs. Stubs
// are conditional on `typeof window !== 'undefined'` — pure-node tests
// hit the false branch and skip the entire block.
// REJECTED ALTERNATIVE: jsdom-environment.ts setup file — splits config
// surface; single setup.ts with guards is simpler.
if (typeof window !== 'undefined') {
  // window.matchMedia — Tailwind responsive utilities may call this.
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }

  // ResizeObserver — DashboardLayout panel sizing (R-UI-03/05 surface).
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }

  // IntersectionObserver — defensive (not directly used in audited Top-3
  // but RTL convention for any scroll-aware component).
  if (!('IntersectionObserver' in globalThis)) {
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class IntersectionObserverStub {
      readonly root: Element | null = null
      readonly rootMargin: string = ''
      readonly thresholds: ReadonlyArray<number> = []
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): unknown[] {
        return []
      }
    }
  }

  // requestAnimationFrame / cancelAnimationFrame — CriticalOverlayFx +
  // Toast + DashboardLayout globe rotation rely on rAF. jsdom 26+
  // typically provides this, but we polyfill defensively for older
  // jsdom versions and for forced sync test mode.
  if (typeof window.requestAnimationFrame !== 'function') {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16) as unknown as number
  }
  if (typeof window.cancelAnimationFrame !== 'function') {
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle)
  }
}

// SENIOR ARCHITECT NOTE: matcher types are augmented above via
// `declare module 'vitest'`. No re-export needed — Phase 4.D test
// files use `toHaveNoViolations` via expect chaining (no direct
// import), and the augmentation makes tsc aware of the matcher.

// SENIOR ARCHITECT NOTE: vi.stubEnv (not direct process.env assignment) so
// restoreMocks: true (already in vitest.config) automatically restores between tests.
// REJECTED ALTERNATIVE: process.env.X = value — leaks across worker tests in the same file.
vi.stubEnv('SOC_STORAGE', 'memory')
vi.stubEnv('SOC_IDENTITY_STORE', 'disabled')
vi.stubEnv('RESEND_API_KEY', 'test-key-do-not-use')
vi.stubEnv('TRUST_PROXY_HEADERS', '0')
vi.stubEnv('SOC_DEMO_SECRET', 'test-secret-do-not-use')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')

// SENIOR ARCHITECT NOTE: onUnhandledRequest: 'error' fails any test that hits a real
// network call we forgot to mock — this is the determinism guarantee, not paranoia.
// REJECTED ALTERNATIVE: 'warn' — silently passes tests that make real network calls,
// breaking hermetic test discipline.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(async () => {
  server.resetHandlers()
  // SENIOR ARCHITECT NOTE: __resetAllForTests has an R-08 NODE_ENV guard
  // (Phase 1.5.9 hardening — throws when NODE_ENV=production). Some tests
  // transiently stub NODE_ENV=production (e.g., T-AD07/T-AD08/T-AD09 R-03
  // Path γ tests). The stub is restored by Vitest's restoreMocks: true AFTER
  // this afterEach runs, so at this point NODE_ENV may still be 'production'.
  // Cleanup is best-effort — swallow the guard's throw to keep test
  // isolation robust. Tests that legitimately verify the guard (T-R09)
  // assert the throw directly within their test body.
  try {
    await __resetAllForTests()
  } catch (err) {
    if (err instanceof Error && err.message.includes('prohibited in production')) {
      return
    }
    throw err
  }
})

afterAll(() => {
  server.close()
})
