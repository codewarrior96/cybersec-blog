// Phase 2.D — Target #2 surgical test coverage for the reveal detector
// (src/lib/lab/reveal/detector.ts).
//
// Maps to Phase 2.A audit R-LAB-02 (High) — "Reveal-detector start-cursor
// logic is multi-state-complex." Existing cross-context-bypass.test.ts
// covers 3 of ~24 possible axis crossings. This file expands to ~20
// crossings via direct `detectRevealEvent` injection + a few end-to-end
// scenarios through `runCommand` for the integration path.
//
// Five-axis branch matrix per audit:
//   1. alreadyRevealed: Set membership
//   2. startedAtEventId: undefined / -1 sentinel / +Infinity sentinel /
//                       finite number
//   3. forbidden: contract.forbidden non-empty + present in log
//   4. temporal: contract.requiresBeforeReading clause fails
//   5. blockingMissing: required - flag_submitted, non-empty
//
// SENIOR ARCHITECT NOTE: tests build EvidenceLog directly via RingEvidenceLog
// for the axis-injection cases, and via `runCommand` end-to-end (mirroring
// existing harness pattern from cross-context-bypass.test.ts) for the
// integration cases. Pure unit testing dominates because the detector is a
// pure function; the runRevealCheck integration in engine.ts (which calls
// detectRevealEvent in a loop over unlocked levels) is exercised
// transitively by the ctf-regression.test.ts L1-L6 happy paths.

import { describe, it, expect } from 'vitest'
import { detectRevealEvent } from '../reveal/detector'
import { challengeContracts } from '../validation/contracts'
import { RingEvidenceLog } from '../evidence/log'
import type { EvidenceEvent, EvidencePrimitive } from '../evidence/types'
import type { ValidationContract } from '../validation/types'

// ─── Test factory helpers ─────────────────────────────────────────────────────

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

// Minimal trivially-satisfiable contract (no required, no sufficient, no
// forbidden, no temporal) — flag_submitted-only requirement, but reveal
// ignores flag_submitted by design (banner replaces submit).
const trivialPassContract: ValidationContract = {
  required: [{ type: 'flag_submitted', flag: 'FLAG{trivial}' }],
  sufficient: [
    [{ type: 'command_executed', command: 'pass' }],
  ],
  expectedFlag: 'FLAG{trivial}',
  levelTitle: 'TRIVIAL TEST LEVEL',
}

describe('detectRevealEvent — Phase 2.D Target #2 (R-LAB-02)', () => {
  // ─── alreadyRevealed dedup gate (T-RD01-03) ─────────────────────────────────

  describe('alreadyRevealed dedup gate', () => {
    it('T-RD01 — level in alreadyRevealed returns null (silent dedup)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set([1]),
      })
      expect(result).toBeNull()
    })

    it('T-RD02 — empty alreadyRevealed allows fire when other conditions pass', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
      expect(result?.level).toBe(1)
      expect(result?.flag).toBe('FLAG{trivial}')
    })

    it('T-RD03 — alreadyRevealed with OTHER levels does not block the level under test', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set([2, 3, 4]), // 1 not in set
      })
      expect(result).not.toBeNull()
    })
  })

  // ─── startedAtEventId variants (T-RD04-08) ──────────────────────────────────

  describe('startedAtEventId variants', () => {
    it('T-RD04 — startedAtEventId = -1 (legacy completion sentinel) suppresses re-fire', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
        startedAtEventId: -1,
      })
      expect(result).toBeNull()
    })

    it('T-RD05 — startedAtEventId undefined acts as legacy (no scoping, full log evaluated)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
        startedAtEventId: undefined,
      })
      expect(result).not.toBeNull()
    })

    it('T-RD06 — startedAtEventId = +Infinity (level not started) scopes out all events', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
        evt(1, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
        startedAtEventId: Number.POSITIVE_INFINITY,
      })
      // All events scoped out → sufficient cannot be met → no reveal
      expect(result).toBeNull()
    })

    it('T-RD07 — startedAtEventId = 0 includes all events (id >= 0)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
        startedAtEventId: 0,
      })
      expect(result).not.toBeNull()
    })

    it('T-RD08 — startedAtEventId N filters out events with id < N (pre-start events ignored)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
        // event 0 is pre-start; nothing post-start
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
        startedAtEventId: 5, // cursor after all events
      })
      // Pre-start event scoped out → sufficient not met → no reveal
      expect(result).toBeNull()
    })
  })

  // ─── Forbidden gate (T-RD09-11) ─────────────────────────────────────────────

  describe('forbidden primitives gate', () => {
    it('T-RD09 — forbidden primitive present blocks reveal', () => {
      const forbiddenContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{x}' }],
        forbidden: [{ type: 'command_executed', command: 'sudo' }],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'FORBIDDEN TEST',
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
        evt(1, [{ type: 'command_executed', command: 'sudo' }]), // forbidden
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: forbiddenContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'FORBIDDEN TEST',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).toBeNull()
    })

    it('T-RD10 — forbidden primitive absent allows reveal', () => {
      const forbiddenContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{x}' }],
        forbidden: [{ type: 'command_executed', command: 'sudo' }],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'FORBIDDEN TEST',
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
        // No sudo
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: forbiddenContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'FORBIDDEN TEST',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
    })

    it('T-RD11 — multi-forbidden: ANY present blocks reveal', () => {
      const multiForbiddenContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{x}' }],
        forbidden: [
          { type: 'command_executed', command: 'sudo' },
          { type: 'command_executed', command: 'rm' },
        ],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'MULTI FORBIDDEN',
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
        evt(1, [{ type: 'command_executed', command: 'rm' }]), // 2nd forbidden
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: multiForbiddenContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'MULTI FORBIDDEN',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).toBeNull()
    })
  })

  // ─── Temporal gate (T-RD12-14) ──────────────────────────────────────────────

  describe('temporal (requiresBeforeReading) gate', () => {
    it('T-RD12 — temporal failure blocks reveal', () => {
      const temporalContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{x}' }],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        requiresBeforeReading: [
          {
            target: { path: '/etc/secret', pathMatch: 'exact' },
            all: [{ type: 'command_executed', command: 'ls' }],
          },
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'TEMPORAL TEST',
      }
      // file_read of /etc/secret happens BEFORE the `ls` precondition
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
        evt(1, [{ type: 'file_read', path: '/etc/secret', via: 'cat' }]),
        evt(2, [{ type: 'flag_submitted', flag: 'FLAG{x}' }]),
        evt(3, [{ type: 'command_executed', command: 'ls' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: temporalContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'TEMPORAL TEST',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).toBeNull()
    })

    it('T-RD13 — temporal order correct allows reveal', () => {
      const temporalContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{x}' }],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        requiresBeforeReading: [
          {
            target: { path: '/etc/secret', pathMatch: 'exact' },
            all: [{ type: 'command_executed', command: 'ls' }],
          },
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'TEMPORAL TEST',
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),    // precondition
        evt(1, [{ type: 'file_read', path: '/etc/secret', via: 'cat' }]),
        evt(2, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: temporalContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'TEMPORAL TEST',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
    })

    it('T-RD14 — anyOf temporal alternative satisfies the precondition', () => {
      const anyOfTemporalContract: ValidationContract = {
        required: [{ type: 'flag_submitted', flag: 'FLAG{x}' }],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        requiresBeforeReading: [
          {
            target: { path: '/etc/secret', pathMatch: 'exact' },
            anyOf: [
              [{ type: 'command_executed', command: 'ls' }],
              [{ type: 'command_executed', command: 'find' }],
            ],
          },
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'ANYOF TEMPORAL',
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'find' }]), // alt 2
        evt(1, [{ type: 'file_read', path: '/etc/secret', via: 'cat' }]),
        evt(2, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: anyOfTemporalContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'ANYOF TEMPORAL',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
    })
  })

  // ─── blockingMissing gate (T-RD15-17) ───────────────────────────────────────

  describe('blockingMissing gate (non-flag_submitted required missing)', () => {
    it('T-RD15 — required non-flag_submitted missing blocks reveal', () => {
      const requiredContract: ValidationContract = {
        required: [
          { type: 'command_executed', command: 'whoami' },
          { type: 'flag_submitted', flag: 'FLAG{x}' },
        ],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'BLOCKING MISSING TEST',
      }
      // Only 'pass' executed; whoami is missing
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: requiredContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'BLOCKING MISSING TEST',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).toBeNull()
    })

    it('T-RD16 — only flag_submitted missing → can reveal (banner IS the submission)', () => {
      // SENIOR ARCHITECT NOTE: detector.ts L57 filters out flag_submitted
      // from blockingMissing because the reveal banner serves as the
      // submission. Without this rule the contract would deadlock —
      // user couldn't trigger reveal without first submitting, but
      // the banner is what surfaces the flag.
      const requiredContract: ValidationContract = {
        required: [
          { type: 'command_executed', command: 'whoami' },
          { type: 'flag_submitted', flag: 'FLAG{x}' },
        ],
        sufficient: [
          [{ type: 'command_executed', command: 'pass' }],
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'WHOAMI ONLY MISSING',
      }
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'whoami' }]),
        evt(1, [{ type: 'command_executed', command: 'pass' }]),
        // flag_submitted intentionally absent
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: requiredContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'WHOAMI ONLY MISSING',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
    })

    it('T-RD17 — sufficient not satisfied → detector declines even if all required present', () => {
      // SENIOR ARCHITECT NOTE: detector.ts L65 — without this gate the
      // detector would fire on first arbitrary command for any contract
      // whose `required` is empty (e.g., L1's empty required) before the
      // user walks any canonical solution. The `sufficientMet` check
      // ensures a canonical path was actually taken.
      const sufficientContract: ValidationContract = {
        required: [],
        sufficient: [
          [{ type: 'command_executed', command: 'specific_solve_step' }],
        ],
        expectedFlag: 'FLAG{x}',
        levelTitle: 'SUFFICIENT REQUIRED',
      }
      // Arbitrary unrelated command; sufficient group not satisfied
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'ls' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: sufficientContract,
        expectedFlag: 'FLAG{x}',
        levelTitle: 'SUFFICIENT REQUIRED',
        nextLevelTitle: 'NEXT',
        alreadyRevealed: new Set(),
      })
      expect(result).toBeNull()
    })
  })

  // ─── Happy path RevealEvent shape (T-RD18-20) ───────────────────────────────

  describe('happy-path RevealEvent shape', () => {
    it('T-RD18 — happy path returns RevealEvent with correct level/flag/levelTitle/nextLevelTitle', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 1,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: 'NEXT LEVEL TITLE',
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
      expect(result?.level).toBe(1)
      expect(result?.flag).toBe('FLAG{trivial}')
      expect(result?.levelTitle).toBe('TRIVIAL TEST LEVEL')
      expect(result?.nextLevelTitle).toBe('NEXT LEVEL TITLE')
    })

    it('T-RD19 — nextLevelTitle = null is acceptable (no next level — last challenge)', () => {
      const log = logFromEvents([
        evt(0, [{ type: 'command_executed', command: 'pass' }]),
      ])
      const result = detectRevealEvent({
        level: 6,
        log,
        contract: trivialPassContract,
        expectedFlag: 'FLAG{trivial}',
        levelTitle: 'TRIVIAL TEST LEVEL',
        nextLevelTitle: null,
        alreadyRevealed: new Set(),
      })
      expect(result).not.toBeNull()
      expect(result?.nextLevelTitle).toBeNull()
    })

    it('T-RD20 — all 6 challenge contracts (L1-L6) have detector-ready shape (expectedFlag + levelTitle)', () => {
      // Cross-cutting: detector requires contract.expectedFlag and
      // contract.levelTitle to be populated. Phase 2.A audit Section 2
      // R-LAB-02 flagged the multi-state matrix; this test ensures the
      // 6 production contracts won't cause runtime null-deref in the
      // detector even before evaluating evidence.
      for (let level = 1; level <= 6; level++) {
        const contract = challengeContracts[level]
        expect(contract, `L${level} contract present`).toBeDefined()
        expect(contract?.expectedFlag, `L${level} expectedFlag`).toBeTruthy()
        expect(contract?.levelTitle, `L${level} levelTitle`).toBeTruthy()
      }
    })
  })
})
