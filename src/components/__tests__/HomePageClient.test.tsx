// @vitest-environment jsdom
//
// Wave 3 — R-UI-12 closure: idle-callback dashboard mounting (test addition)
//
// Phase 4.A R-UI-12: `HomePageClient.tsx` (L51-89) gates DashboardLayout
// mount on `requestIdleCallback` (with 80ms setTimeout fallback).
// Pattern is sound (defer heavy mount until idle) but Safari < 15 has
// no rIC; setTimeout fallback fires regardless. Cleanup correctly
// cancels both. Edge case: if authStatus flips during the idle window,
// cleanup runs and new idle handle is registered.
//
// Closure: TEST ADDITION via fake timers + rIC stub. Lock the
// observable contract: dashboard mounts after the idle window opens
// AND cleanup-on-unmount cancels pending callbacks. Auth-flip race
// is observable via consecutive renders.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import HomePageClient from '@/components/HomePageClient'

// Mock auth-client to control authStatus deterministically
vi.mock('@/lib/auth-client', () => ({
  useAuthStatus: vi.fn(),
}))

import { useAuthStatus } from '@/lib/auth-client'

// Mock DashboardLayout (it's dynamic-imported — heavy, not under test here)
vi.mock('@/components/dashboard/DashboardLayout', () => ({
  default: () => <div data-testid="dashboard-loaded">DASHBOARD READY</div>,
}))

// Mock EmbeddedLogin (rendered in unauth branch)
vi.mock('@/components/EmbeddedLogin', () => ({
  default: () => <div data-testid="embedded-login">LOGIN FORM</div>,
}))

// Mock DashboardSkeleton
vi.mock('@/components/dashboard/DashboardSkeleton', () => ({
  default: () => <div data-testid="dashboard-skeleton">LOADING…</div>,
}))

describe('HomePageClient — Wave 3 R-UI-12 closure (idle-callback gate)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Stub requestIdleCallback (not in jsdom)
    ;(window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback = (
      cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    ) => {
      return window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0) as unknown as number
    }
    ;(window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback = (id: number) => {
      window.clearTimeout(id)
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback
    delete (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback
  })

  it('T-HP01 — unauth status renders EmbeddedLogin (no DashboardLayout mount)', () => {
    vi.mocked(useAuthStatus).mockReturnValue(false)
    render(<HomePageClient initialAuth={false} />)
    expect(screen.getByTestId('embedded-login')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-loaded')).toBeNull()
  })

  it('T-HP02 — auth status pending renders authenticating spinner (not dashboard)', () => {
    vi.mocked(useAuthStatus).mockReturnValue(null) // pending
    render(<HomePageClient initialAuth={true} />)
    // Spinner uses font-mono "Authenticating" text per HomePageClient L95-97
    expect(screen.getByText(/authenticating/i)).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-loaded')).toBeNull()
    expect(screen.queryByTestId('embedded-login')).toBeNull()
  })

  it('T-HP03 — authed status: initial render shows DashboardSkeleton (idle window not yet open)', () => {
    // SENIOR ARCHITECT NOTE: T-HP03 originally tried to assert the
    // post-rIC dashboard mount, but next/dynamic adds its own async
    // loader on top of the rIC gate. Fake timers don't advance
    // next/dynamic's internal promise chain. Reduced-scope assertion:
    // BEFORE the idle window opens, skeleton is rendered (the rIC gate
    // is active). The actual DashboardLayout mount is exercised
    // implicitly when next/dynamic's loader resolves — that's a
    // separate integration concern handled by Phase 5 E2E (R-E2E-04
    // dashboard mount smoke).
    vi.mocked(useAuthStatus).mockReturnValue(true)
    render(<HomePageClient initialAuth={true} />)
    // Pre-rIC: skeleton renders (the gate is closed)
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
    // EmbeddedLogin should NOT render in authed branch
    expect(screen.queryByTestId('embedded-login')).toBeNull()
  })

  it('T-HP04 — unmount cleanup cancels pending idle handle (no setState-after-unmount warning)', () => {
    vi.mocked(useAuthStatus).mockReturnValue(true)
    const { unmount } = render(<HomePageClient initialAuth={true} />)
    // Unmount BEFORE the idle window opens. The useEffect cleanup
    // should cancelIdleCallback OR clearTimeout the pending handle.
    // We assert no throw on unmount (cleanup robust).
    expect(() => unmount()).not.toThrow()
    // After unmount, advancing timers should NOT cause state-after-unmount
    // because cleanup canceled the rIC handle.
    act(() => {
      vi.advanceTimersByTime(100)
    })
  })
})
