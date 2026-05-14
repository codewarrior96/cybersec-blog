// Phase 2.D — Target #1 surgical test coverage for the validation contract
// evaluator (src/lib/lab/validation/contract.ts).
//
// Maps to Phase 2.A audit R-LAB-03 (High) — "Validation contract evaluator +
// temporal clauses are correctness-critical." Existing CTF regression tests
// (ctf-regression.test.ts) exercise happy paths for L1-L6; this file fills
// the gap for negative temporal scenarios, forbidden primitives, scoping
// cursor edge cases (-1 / undefined / +Infinity sentinels), and contract
// shape verification.
//
// SENIOR ARCHITECT NOTE: `validateContract` is a pure function over an
// EvidenceLog and a ValidationContract. No mocks, no fixtures beyond
// inline synthetic events. The test factory `evt(id, primitive)` produces
// minimal-shape EvidenceEvent values directly — Phase 2.A Section 6+7
// confirmed Lab Engine has zero external deps warranting Phase 2.B/2.C
// infra/mock cycles.
//
// REJECTED ALTERNATIVE: build EvidenceLog via `runCommand` end-to-end (the
// ctf-regression.test.ts pattern). Rejected for THIS file because the unit
// under test is the contract evaluator itself — direct primitive injection
// is the cleaner contract. End-to-end coverage lives in
// reveal-detector.test.ts (Target #2) where the contract evaluator is
// exercised transitively.

import { describe, it, expect } from 'vitest'
import { validateContract } from '../validation/contract'
import { challengeContracts } from '../validation/contracts'
import { RingEvidenceLog } from '../evidence/log'
import type { EvidenceEvent, EvidencePrimitive } from '../evidence/types'
import type { ValidationContract } from '../validation/types'

// ─── Test factory helpers (file-local, not exported) ──────────────────────────

function evt(id: number, primitives: EvidencePrimitive[], overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    id,
    timestamp: id * 1000,
    raw: 'test',
    command: 'test',
    args: [],
    cwdBefore: '/home/operator',
    cwdAfter: '/home/operator',
    output: [],
    exitCode: 0,
    primitives,
    source: 'user',
    ...overrides,
  }
}

function logFromEvents(events: EvidenceEvent[]): RingEvidenceLog {
  return events.reduce<RingEvidenceLog>(
    (acc, event) => acc.append(event) as RingEvidenceLog,
    new RingEvidenceLog(),
  )
}

// Minimal contract fixtures (file-local, not the real challenge contracts)

const emptyContract: ValidationContract = { required: [] }

const requiredOnlyContract: ValidationContract = {
  required: [
    { type: 'command_executed', command: 'whoami' },
    { type: 'command_executed', command: 'pwd' },
  ],
}

const forbiddenOnlyContract: ValidationContract = {
  required: [],
  forbidden: [
    { type: 'command_executed', command: 'rm' },
  ],
}

const sufficientOnlyContract: ValidationContract = {
  required: [],
  sufficient: [
    // Group A: whoami AND pwd
    [
      { type: 'command_executed', command: 'whoami' },
      { type: 'command_executed', command: 'pwd' },
    ],
    // Group B: ls alone
    [
      { type: 'command_executed', command: 'ls' },
    ],
  ],
}

const temporalContract: ValidationContract = {
  required: [
    { type: 'flag_submitted', flag: 'FLAG{test}' },
  ],
  requiresBeforeReading: [
    {
      target: { path: '/etc/passwd', pathMatch: 'exact' },
      all: [
        { type: 'command_executed', command: 'ls' },
      ],
    },
  ],
}

describe('validateContract — Phase 2.D Target #1 (R-LAB-03)', () => {
  // ─── Basic invariants (T-VC01-05) ───────────────────────────────────────────

  describe('basic invariants', () => {
    it('T-VC01 — empty contract (no required, no sufficient, no forbidden) passes against empty log', () => {
      const result = validateContract(emptyContract, new RingEvidenceLog())
      expect(result.passed).toBe(true)
      expect(result.missing).toEqual([])
      expect(result.forbidden).toEqual([])
      expect(result.temporalFailures).toEqual([])
      expect(result.sufficientMet).toBe(true) // no sufficient clause → vacuously true
    })

    it('T-VC02 — all-required-present passes', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      const result = validateContract(requiredOnlyContract, log)
      expect(result.passed).toBe(true)
      expect(result.missing).toEqual([])
    })

    it('T-VC03 — one required missing reported in missing list, passed=false', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        // pwd intentionally absent
      ])
      const result = validateContract(requiredOnlyContract, log)
      expect(result.passed).toBe(false)
      expect(result.missing).toHaveLength(1)
      expect(result.missing[0]).toMatchObject({ type: 'command_executed', command: 'pwd' })
    })

    it('T-VC04 — all required missing reported in full', () => {
      const log = new RingEvidenceLog()
      const result = validateContract(requiredOnlyContract, log)
      expect(result.passed).toBe(false)
      expect(result.missing).toHaveLength(2)
    })

    it('T-VC05 — sufficient defaults to true when contract has no sufficient clause', () => {
      // requiredOnlyContract has no `sufficient` — sufficientMet must be true
      const log = new RingEvidenceLog()
      const result = validateContract(requiredOnlyContract, log)
      expect(result.sufficientMet).toBe(true)
    })
  })

  // ─── Forbidden primitives (T-VC06-08) ───────────────────────────────────────

  describe('forbidden primitives', () => {
    it('T-VC06 — forbidden present blocks passed=true and is reported', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'rm' }]),
      ])
      const result = validateContract(forbiddenOnlyContract, log)
      expect(result.passed).toBe(false)
      expect(result.forbidden).toHaveLength(1)
      expect(result.forbidden[0]).toMatchObject({ type: 'command_executed', command: 'rm' })
    })

    it('T-VC07 — multiple forbidden primitives all reported', () => {
      const multiForbidden: ValidationContract = {
        required: [],
        forbidden: [
          { type: 'command_executed', command: 'rm' },
          { type: 'command_executed', command: 'sudo' },
        ],
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'rm' }]),
        evt(1, [{ type: 'command_executed', command: 'sudo' }]),
      ])
      const result = validateContract(multiForbidden, log)
      expect(result.passed).toBe(false)
      expect(result.forbidden).toHaveLength(2)
    })

    it('T-VC08 — forbidden absent passes (sufficientMet trivial)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),
      ])
      const result = validateContract(forbiddenOnlyContract, log)
      expect(result.passed).toBe(true)
      expect(result.forbidden).toEqual([])
    })
  })

  // ─── Sufficient groups OR-of-AND (T-VC09-12) ────────────────────────────────

  describe('sufficient OR-of-AND semantics', () => {
    it('T-VC09 — sufficient group A satisfied → passes', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      const result = validateContract(sufficientOnlyContract, log)
      expect(result.passed).toBe(true)
      expect(result.sufficientMet).toBe(true)
    })

    it('T-VC10 — sufficient group B (alone) satisfied → passes', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),
      ])
      const result = validateContract(sufficientOnlyContract, log)
      expect(result.passed).toBe(true)
      expect(result.sufficientMet).toBe(true)
    })

    it('T-VC11 — partial group satisfaction does NOT count (whoami without pwd, no ls)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        // pwd missing → group A incomplete; no ls → group B incomplete
      ])
      const result = validateContract(sufficientOnlyContract, log)
      expect(result.passed).toBe(false)
      expect(result.sufficientMet).toBe(false)
    })

    it('T-VC12 — empty log against contract with sufficient → sufficientMet=false', () => {
      const result = validateContract(sufficientOnlyContract, new RingEvidenceLog())
      expect(result.sufficientMet).toBe(false)
      expect(result.passed).toBe(false)
    })
  })

  // ─── Temporal clauses (T-VC13-17) ───────────────────────────────────────────

  describe('temporal requiresBeforeReading clauses', () => {
    it('T-VC13 — required `ls` executed BEFORE file read → no temporal failure', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),
        evt(1, [{ type: 'file_read', path: '/etc/passwd', via: 'cat' }]),
        evt(2, [{ type: 'flag_submitted', flag: 'FLAG{test}' }]),
      ])
      const result = validateContract(temporalContract, log)
      expect(result.passed).toBe(true)
      expect(result.temporalFailures).toEqual([])
    })

    it('T-VC14 — flag submitted BEFORE the `ls` precondition was met → temporal failure reported', () => {
      // The temporal clause says "before reading /etc/passwd, `ls` must have
      // been executed." The file_read happens at event id 1 (BEFORE `ls` at
      // event id 2). The validator's `temporalFailureExists` looks for ANY
      // valid read-before-submit that satisfies the clause; here, no such
      // read exists, so the temporal failure fires.
      const log = logFromEvents([
        evt(0, [{ type: 'file_read', path: '/etc/passwd', via: 'cat' }]),
        evt(1, [{ type: 'flag_submitted', flag: 'FLAG{test}' }]),
        evt(2, [{ type: 'command_executed', command: 'ls' }]),
      ])
      const result = validateContract(temporalContract, log)
      expect(result.passed).toBe(false)
      expect(result.temporalFailures).toHaveLength(1)
    })

    it('T-VC15 — anyOf temporal clause: any of N alternatives satisfies the precondition', () => {
      const anyOfContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{test}' }],
        requiresBeforeReading: [
          {
            target: { path: '/etc/passwd', pathMatch: 'exact' },
            anyOf: [
              [{ type: 'command_executed', command: 'ls' }],
              [{ type: 'command_executed', command: 'find' }],
            ],
          },
        ],
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'find' }]), // alt 2
        evt(1, [{ type: 'file_read', path: '/etc/passwd', via: 'cat' }]),
        evt(2, [{ type: 'flag_submitted', flag: 'FLAG{test}' }]),
      ])
      const result = validateContract(anyOfContract, log)
      expect(result.passed).toBe(true)
    })

    it('T-VC16 — multiple temporal clauses ALL must pass; if any fails → reported', () => {
      const multiTemporalContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{test}' }],
        requiresBeforeReading: [
          {
            target: { path: '/etc/passwd', pathMatch: 'exact' },
            all: [{ type: 'command_executed', command: 'ls' }],
          },
          {
            target: { path: '/etc/shadow', pathMatch: 'exact' },
            all: [{ type: 'command_executed', command: 'sudo' }],
          },
        ],
      }
      // Satisfies the /etc/passwd clause but NOT /etc/shadow clause
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),
        evt(1, [{ type: 'file_read', path: '/etc/passwd', via: 'cat' }]),
        evt(2, [{ type: 'file_read', path: '/etc/shadow', via: 'cat' }]),
        evt(3, [{ type: 'flag_submitted', flag: 'FLAG{test}' }]),
      ])
      const result = validateContract(multiTemporalContract, log)
      expect(result.passed).toBe(false)
      expect(result.temporalFailures).toHaveLength(1) // /etc/shadow clause failed
    })

    it('T-VC17 — temporal clause FAILS when no file_read of target ever happens (existence-required semantics)', () => {
      // SENIOR ARCHITECT NOTE: `temporalFailureExists` (contract.ts L37-51)
      // checks "is there a valid read of the target that satisfied the
      // precondition?" — returns false (= failure) if no such read exists,
      // even when the target was never read. The clause's semantics is
      // therefore "the read MUST happen AND prerequisites must precede it,"
      // not "if read happens, prerequisites must precede." This is the
      // existence-required interpretation.
      //
      // Implication for contract authors: a `requiresBeforeReading` clause
      // implicitly REQUIRES the target to be read at some point. The L3
      // and L4 challenge contracts pair temporal clauses with `required`
      // primitives that include the file_read, so the existence is
      // independently enforced by `required`. The temporal clause acts as
      // a temporal ordering constraint on TOP of the existence guarantee
      // — never as a "skip if not relevant" predicate.
      //
      // This test locks the existence-required semantic as a regression
      // guard. A future refactor that "fixes" temporal clauses to be
      // vacuously-pass-when-no-read would break L3/L4 cross-context-bypass
      // assumptions.
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),
        // no file_read, no flag_submitted
      ])
      const result = validateContract(temporalContract, log)
      // passed=false because `flag_submitted` is missing from required
      expect(result.passed).toBe(false)
      expect(result.missing).toHaveLength(1)
      // temporalFailures is non-empty: existence-required semantic fires
      // because no valid file_read of /etc/passwd exists in the log
      expect(result.temporalFailures).toHaveLength(1)
    })
  })

  // ─── Scoping cursor sinceEventId (T-VC18-22) ────────────────────────────────

  describe('scoping cursor sinceEventId', () => {
    it('T-VC18 — sinceEventId filters log to events with id >= cursor', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(5, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      // With cursor=3, event 0 is scoped out; event 5 remains.
      const result = validateContract(requiredOnlyContract, log, 3)
      expect(result.missing).toHaveLength(1)
      expect(result.missing[0]).toMatchObject({ command: 'whoami' })
    })

    it('T-VC19 — sinceEventId = -1 (legacy completion sentinel) returns empty-log behavior', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      // Negative sentinel → filterLogSince returns RingEvidenceLog([])
      const result = validateContract(requiredOnlyContract, log, -1)
      expect(result.missing).toHaveLength(2) // all required missing
    })

    it('T-VC20 — sinceEventId = +Infinity yields empty filtered log (no event has id >= +Inf)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      const result = validateContract(requiredOnlyContract, log, Number.POSITIVE_INFINITY)
      expect(result.missing).toHaveLength(2) // no events satisfy >= +Inf
    })

    it('T-VC21 — sinceEventId = 0 returns full log (id >= 0 is all events)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      const result = validateContract(requiredOnlyContract, log, 0)
      expect(result.passed).toBe(true)
    })

    it('T-VC22 — sinceEventId undefined = no scoping (legacy callers, full log)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pwd' }]),
      ])
      const result = validateContract(requiredOnlyContract, log, undefined)
      expect(result.passed).toBe(true)
    })
  })

  // ─── Challenge contracts shape (T-VC23-25) ──────────────────────────────────

  describe('6 challenge contracts shape verification', () => {
    it('T-VC23 — all 6 challenge contracts (L1-L6) are defined', () => {
      for (let level = 1; level <= 6; level++) {
        expect(challengeContracts[level], `challenge ${level} should be defined`).toBeDefined()
      }
    })

    it('T-VC24 — all 6 contracts have non-empty expectedFlag matching FLAG{...} shape', () => {
      for (let level = 1; level <= 6; level++) {
        const contract = challengeContracts[level]
        expect(contract?.expectedFlag).toMatch(/^FLAG\{[\w]+\}$/)
      }
    })

    it('T-VC25 — all 6 contracts have non-empty levelTitle string', () => {
      for (let level = 1; level <= 6; level++) {
        const contract = challengeContracts[level]
        expect(typeof contract?.levelTitle).toBe('string')
        expect(contract?.levelTitle?.length).toBeGreaterThan(0)
      }
    })
  })
})
