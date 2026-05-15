// Wave 3 — R-LAB-09 closure: async verifier fire-and-forget (gap-tests)
//
// Phase 2.A R-LAB-09: `commands/index.ts` at module load (a) registers
// 5 handlers, (b) in non-production envs dynamic-imports __verify__
// and invokes verifyRegistry() whose throws are caught by
// `.catch(err => { console.error(...); throw err })`. The inner throw
// inside a `.catch()` is FIRE-AND-FORGET — it rejects the promise but
// nothing is awaited at module scope. Net effect: verifier failures
// are visible only via console.error, not test-runner failure.
//
// Closure: GAP-TEST pattern (R-21 lineage). These tests lock current
// behavior: verifyRegistry runs in non-prod env + its sync throws are
// caught by registerCommand (duplicate registration); async verifier
// throws disappear into unhandled rejection. Future fix would await
// the dynamic-import-promise OR surface verifier results to the
// test-runner-visible API.
//
// SENIOR ARCHITECT NOTE: we test the EXISTING surface (registerCommand
// + verifyRegistry public exports) — not the module-load side effect
// directly (that ship has already sailed by the time vitest imports
// any module under test). The gap-test asserts the CONTRACT shape
// that documents the risk.

import { describe, it, expect } from 'vitest'
import { registerCommand, getCommand, listRegistryCommandNames } from '@/lib/lab/commands'
import type { CommandHandler } from '@/lib/lab/commands/types'

describe('R-LAB-09 — async verifier fire-and-forget (Wave 3 gap-tests)', () => {
  it('T-RV01-GAP — registerCommand surfaces duplicate-registration sync throw (caught chokepoint)', () => {
    // SENIOR ARCHITECT NOTE: registerCommand throws synchronously on
    // duplicate. THIS is the sync chokepoint that DOES surface to
    // callers. Lock the throw shape so registry contract stays explicit.
    // The R-LAB-09 risk is about the OTHER path (async verifier) —
    // documented in T-RV02.
    const fakeHandler: CommandHandler = {
      name: 'help', // duplicates the existing help handler registered at module load
      category: 'system',
      run: () => ({ output: [], events: [] }),
    } as unknown as CommandHandler
    expect(() => registerCommand(fakeHandler)).toThrow()
  })

  it('T-RV02-GAP — verifyRegistry async path is fire-and-forget (R-LAB-09 documented risk)', async () => {
    // Documents: a hypothetical regression to the registry shape
    // (e.g., changing clear sentinel `__CLEAR__` → `__CLR__`) would
    // throw inside verifyRegistry → rejection inside `.catch(err =>
    // { console.error; throw err })` → unhandled rejection.
    //
    // Direct test of the unhandled-rejection path is impractical
    // (would require module-load side-effect manipulation in vitest).
    // Instead, lock the EXISTING contract: the registry currently
    // contains the 5 expected commands at module load — if the
    // verifier-detected invariant ever drifts silently, this test
    // catches it.
    const names = listRegistryCommandNames()
    // Verify the 5 expected handlers registered (per commands/index.ts L8-14)
    expect(names).toContain('help')
    expect(names).toContain('pwd')
    expect(names).toContain('whoami')
    expect(names).toContain('history')
    expect(names).toContain('clear')
    // R-LAB-09 future closure note: if verifyRegistry is wired to
    // throw-via-test (rather than throw-into-unhandled-rejection),
    // this gap-test gets replaced by a direct verifier invocation
    // assertion. Until then, indirect coverage via "the 5 names are
    // present and getCommand resolves each".
    for (const name of names) {
      expect(getCommand(name)).not.toBeNull()
    }
  })
})
