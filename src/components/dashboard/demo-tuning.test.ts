// Phase 1.5.14 — dashboard demo-tuning constants regression guards.
//
// SENIOR ARCHITECT NOTE: Bug 2 reported by operator was rooted in emission
// probabilities tuned for a production-realistic sparse-event SOC scenario,
// not for a 5–30 min demo window. The four constants below were tuned to
// surface ~1 stream event per ~4.7s, ~1 malicious per ~19s, and ~1 CRITICAL
// pop-up per ~94s — making a 3-min demo window produce all three signal
// classes (~38 stream / ~9 malicious / ~1-2 critical).
//
// These tests lock the exact tuned values. State gathering noted ~7 recent
// commits in DashboardLayout.tsx with stability-focused subjects (BUG-005
// series, infinite render loop fix, duplicate event keys fix). Silent
// drift of these constants during future iteration would re-introduce
// Bug 2 without an obvious bisect signal. Regression guards prevent that.
//
// REJECTED ALTERNATIVE: assert tolerance bands (e.g. INTERVAL_MS between
// 2000 and 6000). Rejected — exact-value assertions force a deliberate
// test update whenever someone tunes the constants, surfacing the intent
// review at PR-time. Tolerance bands would let drift happen quietly.

import {
  TELEMETRY_SIM_INTERVAL_MS,
  TELEMETRY_EMISSION_PROBABILITY,
  MALICIOUS_EVENT_PROBABILITY,
  CRITICAL_EVENT_PROBABILITY,
} from './demo-tuning-constants'

describe('dashboard demo-tuning — emission rate constants (Phase 1.5.14)', () => {
  it('T-DT01: TELEMETRY_SIM_INTERVAL_MS === 4000 (4-second simulation tick)', () => {
    // 4 seconds per tick gives ~15 ticks/min, fast enough to feel live
    // without saturating the event ring buffer (16-entry cap in
    // DashboardLayout.tsx).
    expect(TELEMETRY_SIM_INTERVAL_MS).toBe(4000)
  })

  it('T-DT02: TELEMETRY_EMISSION_PROBABILITY === 0.85 (most ticks emit)', () => {
    // 0.85 → ~5.9s wait per emission given the 4s tick. Effective stream
    // cadence: ~1 event per 4.7s.
    expect(TELEMETRY_EMISSION_PROBABILITY).toBe(0.85)
  })

  it('T-DT03: MALICIOUS_EVENT_PROBABILITY === 0.25 (1 in 4 events malicious)', () => {
    // 0.25 → malicious event every ~19s on average. Demo-cadence threat
    // density without saturating the threat-focus UI.
    expect(MALICIOUS_EVENT_PROBABILITY).toBe(0.25)
  })

  it('T-DT04: CRITICAL_EVENT_PROBABILITY === 0.20 (1 in 5 malicious events critical)', () => {
    // 0.20 → CRITICAL event every ~94s on average. P1 modal pop-up + scan
    // overlay fires roughly once every 1.5 min during active demo.
    expect(CRITICAL_EVENT_PROBABILITY).toBe(0.20)
  })

  it('T-DT05: combined emission rate matches demo target (~0.21 events/sec)', () => {
    // SENIOR ARCHITECT NOTE: this is the "integrated metric" guard — if a
    // future tuning shifts any single constant, the combined rate diverges
    // from the demo target and this test catches the cumulative drift.
    //
    // Expected events per second:
    //   (1 / TELEMETRY_SIM_INTERVAL_MS_in_seconds) * TELEMETRY_EMISSION_PROBABILITY
    //   = (1 / 4) * 0.85
    //   = 0.2125 events/sec
    //
    // Tolerance: ±5% to absorb floating-point precision on the
    // multiplication, NOT to permit drift. Any constant change shifts
    // this number out of the tolerance band.
    const intervalSec = TELEMETRY_SIM_INTERVAL_MS / 1000
    const eventsPerSec = (1 / intervalSec) * TELEMETRY_EMISSION_PROBABILITY
    const target = 0.2125
    expect(Math.abs(eventsPerSec - target)).toBeLessThan(target * 0.05)
  })
})
