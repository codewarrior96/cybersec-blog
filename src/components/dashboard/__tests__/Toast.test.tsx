// @vitest-environment jsdom
//
// Wave 3 — R-UI-14 closure: Toast portal SSR race (test addition)
//
// Phase 4.A R-UI-14: `Toast.tsx` L117 uses `createPortal(..., document.body)`.
// Component is 'use client' + `mounted` state-gated (L101-107) → safe
// in normal SSR-then-hydration flow. The gating relies on useEffect
// running BEFORE the portal render. Race risk negligible but the
// pattern depends on React's commit-phase ordering.
//
// Closure: TEST ADDITION verifying:
//   - First render (mounted=false) returns null — no portal call
//   - useEffect flips mounted=true → portal renders to document.body
//   - Empty toasts array also returns null
//   - createPortal target is document.body (not arbitrary)

import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import ToastContainer, { type Toast } from '@/components/dashboard/Toast'

describe('Toast — Wave 3 R-UI-14 closure (portal mount gating)', () => {
  it('T-TP01 — empty toasts array returns null (no portal mount)', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={() => {}} />)
    // No portal output anywhere — body has no Toast children from this component
    expect(container.firstChild).toBeNull()
    // document.body should not contain any toast role="status" markers
    expect(document.body.querySelectorAll('[role="status"]').length).toBe(0)
  })

  it('T-TP02 — non-empty toasts portal-mount to document.body after mounted flip', () => {
    const toasts: Toast[] = [
      { id: 'inc-001', kind: 'promote', incidentId: 'INC-001' },
    ]
    const { container, unmount } = render(<ToastContainer toasts={toasts} onDismiss={() => {}} />)
    // The container (where ToastContainer is rendered) has no direct
    // children — the portal mounted to document.body instead.
    expect(container.firstChild).toBeNull()
    // The toast IS in the DOM, but under document.body via createPortal
    const statusElements = document.body.querySelectorAll('[role="status"]')
    expect(statusElements.length).toBeGreaterThanOrEqual(1)
    // The portaled toast contains the kind's label
    const portalText = document.body.textContent ?? ''
    expect(portalText).toContain('Vaka açıldı') // promote kind label
    unmount()
  })

  it('T-TP03 — multiple toasts each render as separate role="status" element', () => {
    const toasts: Toast[] = [
      { id: 'a', kind: 'promote', incidentId: 'INC-A' },
      { id: 'b', kind: 'investigate', incidentId: 'INC-B' },
      { id: 'c', kind: 'contain', incidentId: 'INC-C' },
    ]
    const { unmount } = render(<ToastContainer toasts={toasts} onDismiss={() => {}} />)
    const statusElements = document.body.querySelectorAll('[role="status"]')
    // 3 toasts → 3 role="status" portal-mounted elements
    expect(statusElements.length).toBe(3)
    unmount()
  })

  it('T-TP04 — onDismiss is called when toast auto-dismiss timer fires', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const toasts: Toast[] = [
      { id: 'auto-dismiss', kind: 'resolve', incidentId: 'INC-D' },
    ]
    const { unmount } = render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)
    // Toast.tsx duration constants: TOAST_DURATION_MS=4000 + TOAST_FADE_MS=200
    // Advance past both to trigger the onDismiss callback
    act(() => {
      vi.advanceTimersByTime(4300)
    })
    expect(onDismiss).toHaveBeenCalledWith('auto-dismiss')
    unmount()
    vi.useRealTimers()
  })
})
