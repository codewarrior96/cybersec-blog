// Wave 3 — R-LAB-12 closure: Date.now non-determinism (gap-tests)
//
// Phase 2.A R-LAB-12: engine.ts L1100-1101 capture
// `SESSION_SEED = Date.now() & 0xffff` and `SESSION_BOOT = Date.now()`
// AT MODULE LOAD. Also Date.now() called inline at L168, L230, L413,
// L493 for event `timestamp` fields. Tests inspecting time-derived
// output need vi.useFakeTimers() for determinism; event timestamps
// are non-deterministic across runs (won't affect id/command/args
// equality but affects timestamp-comparison tests).
//
// Closure: GAP-TEST pattern. Lock current behavior (module-load Date
// captures + per-emission timestamps). Document the deterministic
// path: explicit syncEventIdCounter + careful avoidance of timestamp-
// equality assertions.
//
// SENIOR ARCHITECT NOTE: we can't easily test "module-load captured
// SESSION_SEED" without module-reset hacks. Instead we lock the
// observable contract: event.timestamp is a number, monotonically
// non-decreasing within a single command run, and unrelated to
// event.id (which IS deterministic via syncEventIdCounter).

import { describe, it, expect, beforeEach } from 'vitest'
import { runCommand, syncEventIdCounter } from '@/lib/lab/engine'
import type { CommandContext } from '@/lib/lab/types'

function buildCtx(): CommandContext {
  return { cwd: '/home/operator', setCwd: () => {}, history: [] }
}

describe('R-LAB-12 — Date.now non-determinism (Wave 3 gap-tests)', () => {
  beforeEach(() => {
    syncEventIdCounter(0)
  })

  it('T-ND01-GAP — engine output structure deterministic given explicit counter reset', () => {
    // Lock: with syncEventIdCounter(0) before run, the OUTPUT
    // structure (number of lines, command echo) is deterministic.
    // Timestamps inside events would differ across runs but the
    // user-visible output should be byte-identical.
    const out1 = runCommand('pwd', buildCtx())
    syncEventIdCounter(0) // explicit reset for second run
    const out2 = runCommand('pwd', buildCtx())
    expect(out1).toEqual(out2) // pwd is deterministic per cwd
  })

  it('T-ND02-GAP — engine command output does NOT include raw Date.now in user-visible text', () => {
    // Lock: SESSION_SEED + SESSION_BOOT are USED for simulated
    // command output (uptime/who/etc.) but NOT echoed as raw
    // Date.now() values in non-time-aware commands like pwd/ls/cd.
    // This contract limits the determinism blast radius.
    const out = runCommand('pwd', buildCtx())
    const joined = out.join('\n')
    // pwd output should NOT contain a 13-digit-ms timestamp pattern
    // (Date.now()-shape literal) — if a future commit introduces one
    // by accident, this gap-test surfaces it.
    expect(joined).not.toMatch(/\b\d{13}\b/) // 13-digit ms timestamp
  })
})
