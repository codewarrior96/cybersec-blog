// Wave 3 — R-LAB-14 closure: short-flag expansion heuristic (regression)
//
// Phase 2.A R-LAB-14: normalizeArgs expands `-la` → `-l -a` via regex
// `/^-[a-zA-Z]{2,}$/`. Educational fidelity edge: `-Pn` (nmap "no ping"
// single flag) expands to `-P -n`, semantically wrong for nmap but
// matches the general short-flag-cluster convention (-rf, -la).
//
// Closure: REGRESSION TEST pattern. Heuristic is INTENTIONAL (matches
// most Unix tools); -Pn nmap edge is a documented foot-gun for future
// contract authors. Lock current behavior so refactors don't silently
// change the expansion rule.

import { describe, it, expect } from 'vitest'
import { normalizeArgs } from '@/lib/lab/evidence/normalize'

describe('R-LAB-14 — normalizeArgs short-flag heuristic (Wave 3 regression)', () => {
  it('T-NA01 — short-flag cluster expansion: -la → [-l, -a]', () => {
    const result = normalizeArgs(['-la'])
    expect(result.flags).toEqual(['-l', '-a'])
    expect(result.all).toEqual(['-l', '-a'])
  })

  it('T-NA02 — long-flag preserved as-is: --long-flag stays whole', () => {
    const result = normalizeArgs(['--long-flag'])
    expect(result.flags).toEqual(['--long-flag'])
  })

  it('T-NA03 — single-letter flag preserved: -l → [-l] (not expanded)', () => {
    // regex requires {2,} chars after `-`; single-letter stays whole
    const result = normalizeArgs(['-l'])
    expect(result.flags).toEqual(['-l'])
  })

  it('T-NA04 — digit-containing flag preserved: -9 stays whole (kill-signal-style)', () => {
    // /^-[a-zA-Z]{2,}$/ requires letters; -9 fails the regex → falls
    // to the `arg.startsWith('-')` branch → kept whole. Lock this.
    const result = normalizeArgs(['-9'])
    expect(result.flags).toEqual(['-9'])
  })
})
