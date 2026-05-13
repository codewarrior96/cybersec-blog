// Phase 1.5.14.1 — dashboard demo-tuning constants (extracted module).
//
// SENIOR ARCHITECT NOTE: lives in a dedicated `.ts` file (not the parent
// `DashboardLayout.tsx`) because vitest/vite import analysis cannot parse
// JSX in a `.tsx` file when it's transitively imported from a `.test.ts`
// (decision documented in Phase 1.5.14 commit `a1fa2b5`).
//
// VALUE HISTORY (calm-SOC recalibration — Phase 1.5.14.1):
//   Phase 1.5.14 a1fa2b5 (PUSHED, then iterated):
//     TELEMETRY_SIM_INTERVAL_MS      = 4000   (4s tick)
//     TELEMETRY_EMISSION_PROBABILITY = 0.85
//     MALICIOUS_EVENT_PROBABILITY    = 0.25
//     CRITICAL_EVENT_PROBABILITY     = 0.20
//   → produced ~38 stream / ~1-2 critical per 3-min window. Operator
//     observed deployment and flagged the tone as demo-spam — wanted
//     calm SOC professional cadence instead.
//
//   Phase 1.5.14.1 (this commit): recalibrated to calm SOC cadence.
//
// Calm SOC cadence targets:
//   - 1 stream event per ~25s on average     ((1/10s) * 0.40)^-1
//   - 1 malicious event per ~83s on average  (stream_rate * 0.30)^-1
//   - 1 CRITICAL event per ~298s on average  (malicious_rate * 0.28)^-1
//     ≈ 5 min (operator target ✓)
//
// 5-min demo window → ~12 stream / ~3-4 malicious / ~1 CRITICAL events.
// Stream feels alive but not spammy; critical pop-up becomes a deliberate
// operator-attention event rather than background noise.
//
// T-DT01..T-DT05 in demo-tuning.test.ts lock these exact values so any
// future tuner has to update the tests at the same PR — surfacing intent
// review and preventing silent drift.

/** Demo: yeni telemetry olayı üretim aralığı (SLA sayacı da buna göre azalır). */
export const TELEMETRY_SIM_INTERVAL_MS = 10000

/** Demo: her tick'te olay yayma olasılığı (calm SOC: 0.40 ⇒ ~25s/event). */
export const TELEMETRY_EMISSION_PROBABILITY = 0.40

/** Demo: emit edilen olayın zararlı olma olasılığı (0.30 ⇒ malicious ~83s). */
export const MALICIOUS_EVENT_PROBABILITY = 0.30

/** Demo: zararlı olay verildiğinde, olayın CRITICAL olma olasılığı (0.28 ⇒ critical ~298s ≈ 5 min). */
export const CRITICAL_EVENT_PROBABILITY = 0.28
