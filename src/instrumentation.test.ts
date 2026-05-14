// Phase 1.5.15 — A-17 closure: Next.js boot validator regression guards.
//
// SENIOR ARCHITECT NOTE: tests the `register()` hook in src/instrumentation.ts.
// Three narrow regression guards covering the three control-flow branches:
//   T-INSTR01 — nodejs runtime + no build phase + env unset → throws
//   T-INSTR02 — non-nodejs runtime → no-op (even when env unset)
//   T-INSTR03 — nodejs runtime + build phase → no-op (the A-17 build fix)
//
// REJECTED ALTERNATIVE: assert end-to-end Next.js boot behavior via spawning
// `next start`. Rejected — slow, flaky, requires full server harness. The
// register() function is pure (no I/O, no async ops, no module side-effects);
// direct invocation is sufficient and hermetic.

import { register } from './instrumentation'

describe('instrumentation — boot validator (Phase 1.5.15 A-17 closure)', () => {
  it('T-INSTR01: nodejs runtime + env unset → register() throws with R-20 error message', async () => {
    // SENIOR ARCHITECT NOTE: this is the boot-time fail-loud regression
    // guard. Catches any future refactor that accidentally weakens the
    // SOC_DEMO_SECRET requirement (e.g., adds a default value, swallows
    // the throw, gates the check on additional env conditions).
    //
    // Setup:
    //   NEXT_RUNTIME='nodejs'             — active server runtime
    //   NEXT_PHASE=''                     — NOT the build phase
    //   SOC_DEMO_SECRET undefined         — the vulnerable state
    //
    // Expected: register() rejects with Error whose message matches
    // /SOC_DEMO_SECRET/. The error also identifies the layer
    // ([boot-validator]) so operators see "boot" in the stack and know
    // to set the env BEFORE re-deploying.

    const originalRuntime = process.env.NEXT_RUNTIME
    const originalPhase = process.env.NEXT_PHASE
    const originalSecret = process.env.SOC_DEMO_SECRET

    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NEXT_PHASE', '')
    delete process.env.SOC_DEMO_SECRET

    try {
      await expect(register()).rejects.toThrow(/SOC_DEMO_SECRET/)
    } finally {
      if (originalRuntime !== undefined) vi.stubEnv('NEXT_RUNTIME', originalRuntime)
      if (originalPhase !== undefined) vi.stubEnv('NEXT_PHASE', originalPhase)
      if (originalSecret !== undefined) vi.stubEnv('SOC_DEMO_SECRET', originalSecret)
    }
  })

  it('T-INSTR02: non-nodejs runtime → register() no-ops regardless of env state', async () => {
    // SENIOR ARCHITECT NOTE: edge runtime + middleware/edge handlers have
    // separate env semantics. The boot validator targets the Node.js
    // runtime where session token sign/verify actually executes. Other
    // runtimes should pass through without inspection.
    //
    // Setup:
    //   NEXT_RUNTIME='edge' (or undefined) — non-nodejs
    //   SOC_DEMO_SECRET undefined          — would fail the check IF gate
    //                                       didn't short-circuit
    //
    // Expected: register() resolves cleanly. No throw.

    const originalRuntime = process.env.NEXT_RUNTIME
    const originalSecret = process.env.SOC_DEMO_SECRET

    vi.stubEnv('NEXT_RUNTIME', 'edge')
    delete process.env.SOC_DEMO_SECRET

    try {
      await expect(register()).resolves.toBeUndefined()
    } finally {
      if (originalRuntime !== undefined) vi.stubEnv('NEXT_RUNTIME', originalRuntime)
      if (originalSecret !== undefined) vi.stubEnv('SOC_DEMO_SECRET', originalSecret)
    }
  })

  it('T-INSTR03: nodejs runtime + build phase → register() no-ops (the A-17 build fix)', async () => {
    // SENIOR ARCHITECT NOTE: this is THE A-17 closure regression guard.
    // It directly tests the build-phase escape hatch — if a future change
    // accidentally removes the NEXT_PHASE check, npm run build will
    // re-fail when SOC_DEMO_SECRET is unset, and this test will catch it
    // BEFORE the operator hits the build failure.
    //
    // Setup:
    //   NEXT_RUNTIME='nodejs'                         — active server runtime
    //   NEXT_PHASE='phase-production-build'           — Next.js build phase
    //   SOC_DEMO_SECRET undefined                     — vulnerable state
    //
    // Expected: register() resolves cleanly. No throw. Build proceeds.
    // (Boot validator's env check is deferred until actual server start,
    // which happens after build, when env will be in place.)

    const originalRuntime = process.env.NEXT_RUNTIME
    const originalPhase = process.env.NEXT_PHASE
    const originalSecret = process.env.SOC_DEMO_SECRET

    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    delete process.env.SOC_DEMO_SECRET

    try {
      await expect(register()).resolves.toBeUndefined()
    } finally {
      if (originalRuntime !== undefined) vi.stubEnv('NEXT_RUNTIME', originalRuntime)
      if (originalPhase !== undefined) vi.stubEnv('NEXT_PHASE', originalPhase)
      if (originalSecret !== undefined) vi.stubEnv('SOC_DEMO_SECRET', originalSecret)
    }
  })
})
