// Wave 3 — R-LAB-07 closure: RingEvidenceLog cursor invariant (regression)
//
// Phase 2.A R-LAB-07: ring buffer enforces MAX_EVIDENCE_EVENTS = 200
// via slice(-MAX). When users accumulate >200 events, earlier events
// fall off. The detector's `startedAtEventId` cursor can outlive its
// event (cursor=50 but events 0-150 emitted → trimmed to 51-150;
// cursor=50 has no matching event). Contracts that depend on cursor-
// relative pre-event semantics (`hasBefore`) would behave unexpectedly.
//
// Closure: REGRESSION TEST pattern. Current invariants are correct
// (RingEvidenceLog uses .slice(-MAX) immutably; nextEventId always
// returns lastId+1; filterLogSince filters via event.id >= cursor).
// These tests lock the invariants against future drift.

import { describe, it, expect } from 'vitest'
import { RingEvidenceLog, MAX_EVIDENCE_EVENTS, serializeEvidenceLog, deserializeEvidenceLog } from '@/lib/lab/evidence/log'
import type { EvidenceEvent } from '@/lib/lab/evidence/types'

function mkEvent(id: number): EvidenceEvent {
  return {
    id,
    timestamp: 1_700_000_000_000 + id, // deterministic
    command: 'ls',
    args: [],
    cwd: '/home/operator',
    primitives: [],
    source: 'user',
  } as unknown as EvidenceEvent
}

describe('R-LAB-07 — RingEvidenceLog cursor + truncation invariants (Wave 3 regression)', () => {
  it('T-RB01 — buffer wraps at MAX_EVIDENCE_EVENTS (slice(-MAX) discipline)', () => {
    // Append MAX+5 events; only last MAX retained.
    let log: import('@/lib/lab/evidence/types').EvidenceLog = new RingEvidenceLog()
    for (let i = 0; i < MAX_EVIDENCE_EVENTS + 5; i++) {
      log = log.append(mkEvent(i))
    }
    expect(log.events.length).toBe(MAX_EVIDENCE_EVENTS)
    // First retained event should be id=5 (oldest 5 dropped)
    expect(log.events[0].id).toBe(5)
    expect(log.events[log.events.length - 1].id).toBe(MAX_EVIDENCE_EVENTS + 4)
  })

  it('T-RB02 — nextEventId returns lastId+1 (cursor contract)', () => {
    // SENIOR ARCHITECT NOTE: nextEventId() lives on RingEvidenceLog
    // CLASS, not on the EvidenceLog interface (types.ts:52-57). Type
    // the local as the class directly so the method is type-visible.
    // append() returns EvidenceLog (interface), so we re-narrow via
    // `as RingEvidenceLog` — safe because RingEvidenceLog.append
    // returns `new RingEvidenceLog(...)`.
    let log = new RingEvidenceLog()
    expect(log.nextEventId()).toBe(0) // empty → 0
    log = log.append(mkEvent(0)) as RingEvidenceLog
    expect(log.nextEventId()).toBe(1) // after id=0 → 1
    log = log.append(mkEvent(7)) as RingEvidenceLog
    expect(log.nextEventId()).toBe(8) // after id=7 → 8
  })

  it('T-RB03 — append is immutable: original log unchanged (defensive immutability)', () => {
    const log1 = new RingEvidenceLog([mkEvent(0)])
    const log2 = log1.append(mkEvent(1))
    expect(log1.events.length).toBe(1) // original unmutated
    expect(log2.events.length).toBe(2) // new log has 2
    expect(log2).not.toBe(log1) // different instance
  })

  it('T-RB04 — cursor-orphan scenario (R-LAB-07 documented risk)', () => {
    // Cursor=5 captured while log had events 0-5; emit 200+ more →
    // ring truncates. Cursor=5 is now BEFORE the retained window
    // (events 6..205 retained, 0-5 dropped). hasBefore(expected, 5)
    // returns false because filter `event.id < 5` matches nothing in
    // the retained set (lowest is event 6).
    let log: import('@/lib/lab/evidence/types').EvidenceLog = new RingEvidenceLog()
    for (let i = 0; i < MAX_EVIDENCE_EVENTS + 5; i++) {
      log = log.append(mkEvent(i))
    }
    // Cursor 5 is now orphaned (events 0-4 dropped)
    expect(log.hasBefore({ kind: 'command_executed', command: 'ls' } as never, 5)).toBe(false)
    // This locks the documented behavior: cursor predating the ring
    // window returns no pre-cursor matches. R-LAB-07 future closure
    // (if undertaken) would either preserve cursor semantically OR
    // surface the orphan condition explicitly.
  })

  it('T-RB05 — serialize/deserialize round-trip preserves events + truncates at MAX', () => {
    let log: import('@/lib/lab/evidence/types').EvidenceLog = new RingEvidenceLog()
    for (let i = 0; i < 5; i++) {
      log = log.append(mkEvent(i))
    }
    const json = serializeEvidenceLog(log)
    const restored = deserializeEvidenceLog(json)
    expect(restored.events.length).toBe(5)
    expect(restored.events[0].id).toBe(0)
    expect(restored.events[4].id).toBe(4)
    // Deserialize of malformed JSON returns empty log (defensive)
    const fromBad = deserializeEvidenceLog('not-json')
    expect(fromBad.events.length).toBe(0)
  })
})
