// Wave 2B — R-LAB-11 closure regression tests for the `submit` terminal command.
//
// Phase 2.A R-LAB-11: `cmdSubmit` previously checked `VALID_FLAGS.has(flag)`
// directly and returned a green "FLAG ACCEPTED" banner — bypassing the
// contract evaluator that the panel submission path enforces. A user
// could type `submit FLAG{r3con_master_l1nux}` (a valid string from the
// VALID_FLAGS set) and see the success banner WITHOUT having satisfied
// the challenge contract (panel-side `validateChallengeWithMode`).
//
// Wave 2B fix: terminal submit no longer issues a green banner. It
// returns an informational message redirecting the user to the panel.
// Contract evaluation remains exclusively at the panel layer.
//
// SENIOR ARCHITECT NOTE: tests use the engine's public `runCommand`
// entry point + minimal CommandContext to exercise the dispatch path.
// Test ID prefix matches the Phase 2.D mega-prompt convention
// (T-MO-SUBMIT) — domain is technically engine, not mutation, but the
// prefix is the locked ID set per Wave 2B mega-prompt.
//
// REJECTED ALTERNATIVE: import cmdSubmit directly (it's a module-local
// function, not exported). Rejected — would require either exporting
// (widens API surface) or test-only export shim (code-pollution).
// runCommand integration is the right boundary.

import { describe, it, expect } from 'vitest'
import { runCommand, syncEventIdCounter } from '@/lib/lab/engine'
import type { CommandContext } from '@/lib/lab/types'

function buildCtx(): CommandContext {
  // CommandContext per types.ts L25-36 is minimal: cwd, setCwd, history,
  // optional mutableFs. runCommand RETURNS output lines directly; we
  // collect via return value, not ctx callback.
  return {
    cwd: '/home/operator',
    setCwd: () => {},
    history: [],
  }
}

describe('cmdSubmit — Wave 2B R-LAB-11 closure (terminal-submit bypass removed)', () => {
  it('T-MO-SUBMIT01 — submit with valid FLAG no longer returns green ACCEPTED banner', () => {
    syncEventIdCounter(0)
    // A flag string from VALID_FLAGS — prior behavior: green banner;
    // current behavior: informational redirect only.
    const lines = runCommand('submit FLAG{r3con_master_l1nux}', buildCtx())
    const joined = lines.join('\n')
    // Pre-fix banner text MUST NOT appear (the deceptive success path)
    expect(joined).not.toContain('FLAG ACCEPTED')
    expect(joined).not.toContain('✓')
  })

  it('T-MO-SUBMIT02 — submit output redirects user to panel for evaluation', () => {
    syncEventIdCounter(0)
    const lines = runCommand('submit FLAG{r3con_master_l1nux}', buildCtx())
    const joined = lines.join('\n').toLowerCase()
    // Message mentions "panel" so users know where to submit
    expect(joined).toContain('panel')
  })

  it('T-MO-SUBMIT03 — submit without args returns usage hint (unchanged)', () => {
    syncEventIdCounter(0)
    // No flag argument — should still show usage hint, not the redirect
    const lines = runCommand('submit', buildCtx())
    const joined = lines.join('\n')
    expect(joined.toLowerCase()).toContain('usage:')
  })
})
