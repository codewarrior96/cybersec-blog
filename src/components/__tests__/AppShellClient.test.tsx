// @vitest-environment jsdom
//
// Wave 5A — R-UI-13 closure regression tests for AppShellClient
// prefetch loop abort.
//
// Phase 4.A R-UI-13: prefetch loop fires N promises synchronously
// per pathname change; no AbortController, no cancellation. Wave 5A
// fix: AbortController.signal gates the loop; cleanup aborts.
// Next.js router.prefetch doesn't accept AbortSignal directly, so
// the gate works by short-circuiting NEW iterations after abort
// (in-flight prefetches that already started are framework-managed).
//
// SENIOR ARCHITECT NOTE: the assertion contract here is "unmount
// triggers cleanup → AbortController.abort() called". We don't try
// to assert that already-running prefetches stop — Next.js owns that
// path. The R-UI-13 closure is "no NEW prefetch issued after the
// effect re-runs or component unmounts", which is observable via
// the AbortController.signal.aborted flag.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock Next.js hooks before importing component
const mockPrefetch = vi.fn()
const mockUseRouter = vi.fn(() => ({
  prefetch: mockPrefetch,
  push: vi.fn(),
}))
const mockUsePathname = vi.fn(() => '/home')

vi.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => mockUsePathname(),
}))

vi.mock('@/lib/auth-client', () => ({
  useAuthSession: () => ({ authenticated: true }),
  logoutAuth: vi.fn(),
}))

// Mock heavy child components — AppShellClient's behavior under test
// is the prefetch effect, not the rendered children.
vi.mock('@/components/NavigationBar', () => ({
  default: () => <div data-testid="nav-bar" />,
}))
vi.mock('@/components/Footer', () => ({ default: () => null }))
vi.mock('@/components/PageTransition', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/SearchModal', () => ({ default: () => null }))

import AppShellClient from '@/components/AppShellClient'

describe('AppShellClient — Wave 5A R-UI-13 closure (prefetch abort)', () => {
  beforeEach(() => {
    mockPrefetch.mockClear()
    mockUsePathname.mockReturnValue('/home')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('T-AS-ABORT — unmount calls AbortController.abort (prototype spy)', () => {
    // Spy on AbortController.prototype.abort. Every instance the
    // component constructs shares the same prototype, so this spy
    // captures all abort() calls regardless of how many controllers
    // are created during the test.
    // REJECTED ALTERNATIVE: wrap the global AbortController in a
    // fn-mock. Rejected — vi.fn() isn't constructable; AbortController
    // is invoked via `new`, breaking the mock. Prototype-spy is the
    // robust path for native-class-mocking in jsdom.
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    try {
      const { unmount } = render(
        <AppShellClient initialAuth={true} posts={[]}>
          <div>child</div>
        </AppShellClient>,
      )
      // Pre-unmount: abort should not have been called yet
      const callsBeforeUnmount = abortSpy.mock.calls.length
      // Unmount fires the useEffect cleanup → controller.abort()
      unmount()
      // Post-unmount: at least one new abort call
      expect(abortSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount)
    } finally {
      abortSpy.mockRestore()
    }
  })

  it('T-AS-ABORT-RERUN — pathname change triggers cleanup abort + new controller', () => {
    // R-UI-13 documents: prior implementation fired N prefetch
    // promises on every pathname change without cancelling the
    // previous loop. With AbortController, the cleanup function
    // (returned from useEffect) aborts the prior controller before
    // the next effect call.
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    try {
      const { rerender, unmount } = render(
        <AppShellClient initialAuth={true} posts={[]}>
          <div>child</div>
        </AppShellClient>,
      )
      const callsBeforeRerender = abortSpy.mock.calls.length

      // Trigger pathname change by changing the mock return + re-render
      mockUsePathname.mockReturnValue('/blog')
      rerender(
        <AppShellClient initialAuth={true} posts={[]}>
          <div>child</div>
        </AppShellClient>,
      )

      // Pathname change runs cleanup → abort the prior controller
      expect(abortSpy.mock.calls.length).toBeGreaterThan(callsBeforeRerender)
      unmount()
    } finally {
      abortSpy.mockRestore()
    }
  })
})
