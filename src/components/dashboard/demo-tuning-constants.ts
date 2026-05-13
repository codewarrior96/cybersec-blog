// Phase 1.5.14 — dashboard demo-tuning constants (extracted module).
//
// SENIOR ARCHITECT NOTE: lives in a dedicated `.ts` file (not the parent
// `DashboardLayout.tsx`) for one reason — vitest/vite import analysis
// cannot parse JSX in a `.tsx` file when it's transitively imported from
// a `.test.ts`. Option A in the Phase 1.5.14 mega-prompt (export the
// constants directly from DashboardLayout) failed at test-run time with
// "Failed to parse source for import analysis ... content contains invalid
// JS syntax." Extracting to this small JSX-free module is the minimum
// surface change that preserves both Option A's intent (single source of
// truth, locked via regression tests) and the cycle's atomic discipline.
//
// REJECTED ALTERNATIVE: configure vitest to handle JSX-in-imported-tsx
// for .ts tests. Rejected — vitest config change is a wider-blast-radius
// edit than a 4-constant extraction; it could subtly affect every test in
// the suite, where this change is local to dashboard demo tuning.
//
// REJECTED ALTERNATIVE: rename test file to `demo-tuning.test.tsx` and
// extend vitest `include` pattern. Rejected — same as above (config
// blast radius), AND the test imports no JSX, so renaming to `.tsx`
// would mislead readers.
//
// Demo cadence targets:
//   - 1 stream event per  ~4.7s on average  ((1/4s)*0.85)
//   - 1 malicious event per ~19s on average  ((1/4.7s)*0.25)^-1
//   - 1 CRITICAL event per ~94s on average   ((1/19s)*0.20)^-1
//
// 3-min demo window → ~38 stream / ~9 malicious / ~1-2 CRITICAL events.
//
// T-DT01..T-DT05 in demo-tuning.test.ts lock these exact values so any
// future tuner has to update the tests at the same PR — surfacing intent
// review and preventing silent drift.

/** Demo: yeni telemetry olayı üretim aralığı (SLA sayacı da buna göre azalır). */
export const TELEMETRY_SIM_INTERVAL_MS = 4000

/** Demo: her tick'te olay yayma olasılığı (1.0 = her tick emit eder). */
export const TELEMETRY_EMISSION_PROBABILITY = 0.85

/** Demo: emit edilen olayın zararlı olma olasılığı. */
export const MALICIOUS_EVENT_PROBABILITY = 0.25

/** Demo: zararlı olay verildiğinde, olayın CRITICAL olma olasılığı. */
export const CRITICAL_EVENT_PROBABILITY = 0.20
