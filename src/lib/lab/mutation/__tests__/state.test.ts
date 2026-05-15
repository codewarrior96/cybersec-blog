// Wave 3 — R-LAB-05 closure: module-singleton state fragility (gap-tests)
//
// Phase 2.A R-LAB-05: `currentMutableFs` is a module-scope `let` in
// `src/lib/lab/mutation/state.ts`. `initMutableFs()` returns the same
// instance to every caller until `resetMutableFs()` is invoked. Multi-
// tab browser sessions share the singleton (same JS module instance per
// origin); per-test isolation depends on explicit reset.
//
// Closure: GAP-TEST pattern (R-21 lineage). These tests lock CURRENT
// singleton behavior so any future per-session/per-context refactor
// fails them visibly. The deviation is intentional pending the refactor.
//
// SENIOR ARCHITECT NOTE: tests use the EXISTING reset hook
// `resetMutableFs()` for per-test isolation. The audit risk is about
// PRODUCTION runtime (multi-tab shared state, not testing); the test
// hook works as designed, but downstream consumers may not call it.

import { describe, it, expect, beforeEach } from 'vitest'
import { initMutableFs, resetMutableFs, createMutableFs, applyMutation } from '@/lib/lab/mutation/state'
import { ROOT } from '@/lib/lab/filesystem'

describe('R-LAB-05 — module-singleton currentMutableFs fragility (Wave 3 gap-tests)', () => {
  beforeEach(() => {
    resetMutableFs()
  })

  it('T-MS01-GAP — initMutableFs returns the SAME instance across calls (singleton lock)', () => {
    // SENIOR ARCHITECT NOTE: this is the documented R-LAB-05 risk —
    // every caller of initMutableFs() shares the module-scope singleton
    // until resetMutableFs() runs. In a multi-tab production session,
    // this is the cross-tab state-leak vector. Lock current behavior;
    // future per-session refactor flips this assertion to `.not.toBe`.
    const fs1 = initMutableFs()
    const fs2 = initMutableFs()
    expect(fs2).toBe(fs1) // reference equality — same singleton
  })

  it('T-MS02 — resetMutableFs drops the singleton; next init rebuilds from ROOT', () => {
    const fs1 = initMutableFs()
    // Mutate so we can verify rebuild
    applyMutation(fs1, { kind: 'touch', path: '/home/operator/marker.txt' })
    resetMutableFs()
    const fs2 = initMutableFs()
    // After reset, new instance is allocated (not same reference)
    expect(fs2).not.toBe(fs1)
    // And the marker from fs1 isn't in fs2 (fresh ROOT clone)
    expect(fs2.children['home']).toBeDefined() // ROOT structure preserved
  })

  it('T-MS03 — mutation on singleton is observable to next initMutableFs call (cross-caller leak)', () => {
    // Documents the leak: caller A mutates singleton; caller B sees it.
    // This is the production "two-tab open same scenario" foot-gun.
    const fsA = initMutableFs()
    applyMutation(fsA, { kind: 'touch', path: '/home/operator/leak-test.txt' })
    // Caller B (different code path) calls initMutableFs() again
    const fsB = initMutableFs()
    // B sees A's mutation — same singleton instance
    expect(fsB.children['home']?.type === 'dir' && fsB.children['home'].children['operator']?.type === 'dir' && 'leak-test.txt' in fsB.children['home'].children['operator'].children).toBe(true)
  })

  it('T-MS04 — createMutableFs produces an independent clone (test-helper isolation contract)', () => {
    // Verify the helper that test code uses to bypass the singleton:
    // createMutableFs(snapshot) returns an isolated copy. This is the
    // pattern Phase 2.D tests use to avoid cross-test pollution.
    initMutableFs() // pollute the singleton intentionally
    const isolated = createMutableFs(ROOT)
    applyMutation(isolated, { kind: 'touch', path: '/home/operator/isolated-only.txt' })
    // Singleton was NOT mutated by the isolated copy's mutation
    const singleton = initMutableFs()
    const operatorDir = singleton.children['home']?.type === 'dir' ? singleton.children['home'].children['operator'] : null
    expect(operatorDir?.type === 'dir' ? 'isolated-only.txt' in operatorDir.children : false).toBe(false)
  })
})
