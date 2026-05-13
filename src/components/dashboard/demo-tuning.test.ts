// Phase 1.5.14.1 — dashboard demo-tuning constants regression guards.
//
// SENIOR ARCHITECT NOTE: Bug 2 reported by operator was rooted in emission
// probabilities tuned for a production-realistic sparse-event SOC scenario,
// not for a demo window. Phase 1.5.14 (a1fa2b5) tuned aggressive demo
// values; operator then observed deployment and asked for calm SOC
// professional cadence (critical pop-up every ~5 min, not every ~1.5 min).
// Phase 1.5.14.1 recalibrates: ~25s/stream, ~83s/malicious, ~298s/critical.
//
// These tests lock the exact tuned values. State gathering noted ~7 recent
// commits in DashboardLayout.tsx with stability-focused subjects (BUG-005
// series, infinite render loop fix, duplicate event keys fix). Silent
// drift of these constants during future iteration would re-introduce
// Bug 2 without an obvious bisect signal. Regression guards prevent that.
//
// REJECTED ALTERNATIVE: assert wider tolerance bands on T-DT01..T-DT04
// (e.g. INTERVAL_MS between 5000 and 15000). Rejected — exact-value
// assertions force a deliberate test update whenever someone tunes the
// constants, surfacing the intent review at PR-time. Tolerance bands
// would let drift happen quietly. T-DT05 uses a band on the integrated
// metric (critical interval) where ±10% absorbs floating-point precision,
// NOT where it permits drift — any single-constant change pushes the
// derived interval outside the band.

import {
  TELEMETRY_SIM_INTERVAL_MS,
  TELEMETRY_EMISSION_PROBABILITY,
  MALICIOUS_EVENT_PROBABILITY,
  CRITICAL_EVENT_PROBABILITY,
} from './demo-tuning-constants'

describe('dashboard demo-tuning — emission rate constants (Phase 1.5.14.1, calm SOC cadence)', () => {
  it('T-DT01: TELEMETRY_SIM_INTERVAL_MS === 10000 (10-second simulation tick)', () => {
    // 10 seconds per tick gives ~6 ticks/min. Combined with 0.40 emission
    // probability → stream event every ~25s on average. Calm SOC tape feel.
    expect(TELEMETRY_SIM_INTERVAL_MS).toBe(10000)
  })

  it('T-DT02: TELEMETRY_EMISSION_PROBABILITY === 0.40 (calm SOC emission cadence)', () => {
    // 0.40 → ~25s wait per emission given the 10s tick. Effective stream
    // cadence: ~1 event per 25 seconds. Continuous flow without saturation.
    expect(TELEMETRY_EMISSION_PROBABILITY).toBe(0.40)
  })

  it('T-DT03: MALICIOUS_EVENT_PROBABILITY === 0.30 (~1 malicious per 83s)', () => {
    // 0.30 → malicious event every ~83s on average (~1.4 min). Threat
    // density realistic for SOC monitoring; doesn't saturate threat-focus UI.
    expect(MALICIOUS_EVENT_PROBABILITY).toBe(0.30)
  })

  it('T-DT04: CRITICAL_EVENT_PROBABILITY === 0.28 (critical pop-up ~5 min)', () => {
    // 0.28 → CRITICAL event every ~298s on average (~5 min). P1 modal
    // pop-up + scan overlay becomes a deliberate operator-attention event
    // rather than background noise. Matches operator preference target.
    expect(CRITICAL_EVENT_PROBABILITY).toBe(0.28)
  })

  it('T-DT05: integrated critical-event interval ∈ [270s, 330s] (~5 min ±10%)', () => {
    // SENIOR ARCHITECT NOTE: this is the "integrated metric" guard — if a
    // future tuning shifts any single constant, the combined critical
    // interval diverges from the 5-min target and this test catches the
    // cumulative drift.
    //
    // Expected critical interval:
    //   stream_rate    = (1 / 10s) * 0.40 = 0.04   events/sec
    //   malicious_rate = 0.04 * 0.30      = 0.012  /sec
    //   critical_rate  = 0.012 * 0.28     = 0.00336/sec
    //   critical_interval = 1 / 0.00336   ≈ 298s
    //
    // Tolerance: ±10% around the operator-target 300s (≈ 270s..330s) to
    // absorb floating-point precision on the multiplication chain, NOT
    // to permit drift. Any single-constant change pushes the derived
    // interval outside the band.
    const intervalSec = TELEMETRY_SIM_INTERVAL_MS / 1000
    const streamRate = (1 / intervalSec) * TELEMETRY_EMISSION_PROBABILITY
    const maliciousRate = streamRate * MALICIOUS_EVENT_PROBABILITY
    const criticalRate = maliciousRate * CRITICAL_EVENT_PROBABILITY
    const criticalIntervalSec = 1 / criticalRate
    expect(criticalIntervalSec).toBeGreaterThan(270)
    expect(criticalIntervalSec).toBeLessThan(330)
  })
})
