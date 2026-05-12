import * as supabaseRateLimits from './supabase-rate-limits'
import { checkRateLimit, recordFailure, clearAttempts, __resetAllForTests } from './rate-limiter'

// SENIOR ARCHITECT NOTE: vi.spyOn pattern (not vi.mock) chosen for the
// Supabase dispatcher mocking. Both the test file's namespace import and
// rate-limiter.ts's named imports resolve to the SAME module object (no
// vi.mock factory needed). vi.spyOn attaches mock behavior to the module's
// existing functions, so toggling enabled→true in T-R10/T-R11 reliably
// routes rate-limiter's dispatcher to the spy.
//
// REJECTED ALTERNATIVE: vi.mock with factory returning vi.fn instances.
// Rejected because the named-import-in-rate-limiter vs.
// namespace-import-in-test paths can resolve to different mock instances
// under some Vitest hoisting configurations, breaking dispatcher
// routing tests. vi.spyOn sidesteps this entirely.

// SENIOR ARCHITECT NOTE: __resetAllForTests in beforeEach (in addition to global afterEach
// in setup.ts) protects against within-file state leakage. Each test mutates globalThis
// bucket state; without reset, earlier tests corrupt later ones. Async after Phase 1.5.9
// rate-limiter migration to async public API.
// REJECTED ALTERNATIVE: rely solely on global afterEach — if a test throws mid-execution,
// the next test in the same file may start before cleanup completes in some Vitest versions.
beforeEach(async () => {
  // Default: Supabase disabled → fallback globalThis Map path. T-R10/T-R11
  // override per-test to true.
  vi.spyOn(supabaseRateLimits, 'isSupabaseRateLimitsEnabled').mockReturnValue(false)
  vi.spyOn(supabaseRateLimits, 'checkRateLimitFromSupabase').mockResolvedValue({
    limited: false,
    remaining: 0,
    resetAt: 0,
  })
  vi.spyOn(supabaseRateLimits, 'recordFailureToSupabase').mockResolvedValue({
    limited: false,
    remaining: 0,
    resetAt: 0,
  })
  vi.spyOn(supabaseRateLimits, 'clearAttemptsInSupabase').mockResolvedValue(undefined)
  vi.spyOn(supabaseRateLimits, '__resetAllInSupabaseForTests').mockResolvedValue(undefined)

  await __resetAllForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const OPTS = { bucket: 'test', max: 3, windowMs: 60_000 }

describe('rate-limiter', () => {
  describe('checkRateLimit', () => {
    it('T-R01: first request returns limited=false, remaining=max', async () => {
      const result = await checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })

    it('T-R08: checkRateLimit is idempotent — does not increment count', async () => {
      // Call checkRateLimit multiple times; remaining must not decrease.
      await checkRateLimit('ip-1', OPTS)
      await checkRateLimit('ip-1', OPTS)
      const result = await checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })
  })

  describe('recordFailure', () => {
    it('T-R07: recordFailure decrements remaining on each call', async () => {
      const r1 = await recordFailure('ip-1', OPTS)
      expect(r1.remaining).toBe(2)
      const r2 = await recordFailure('ip-1', OPTS)
      expect(r2.remaining).toBe(1)
      const r3 = await recordFailure('ip-1', OPTS)
      expect(r3.remaining).toBe(0)
    })

    it('T-R02: after max recordFailure calls, limited=true', async () => {
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      const result = await checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(true)
      expect(result.remaining).toBe(0)
    })
  })

  // SENIOR ARCHITECT NOTE: vi.useFakeTimers() is mandatory for window-expiry tests because
  // real Date.now() makes the test depend on wall-clock timing — non-deterministic and flaky
  // in CI under load. Fake timers give precise, hermetic control over the window boundary.
  // REJECTED ALTERNATIVE: real setTimeout wait — slow (would block 60s for a 60s window)
  // and still flaky.
  describe('window expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('T-R03: after window expiry (vi.advanceTimersByTime), returns limited=false', async () => {
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)

      // Confirm limited before expiry
      expect((await checkRateLimit('ip-1', OPTS)).limited).toBe(true)

      // Advance past the window
      vi.advanceTimersByTime(60_001)

      const result = await checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })
  })

  describe('clearAttempts', () => {
    it('T-R04: clearAttempts resets counter for the key', async () => {
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      expect((await checkRateLimit('ip-1', OPTS)).limited).toBe(true)

      await clearAttempts('ip-1', OPTS.bucket)

      const result = await checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })
  })

  describe('isolation', () => {
    it('T-R05: different bucket names are independent', async () => {
      const optsA = { bucket: 'bucket-a', max: 3, windowMs: 60_000 }
      const optsB = { bucket: 'bucket-b', max: 3, windowMs: 60_000 }

      await recordFailure('ip-1', optsA)
      await recordFailure('ip-1', optsA)
      await recordFailure('ip-1', optsA)
      expect((await checkRateLimit('ip-1', optsA)).limited).toBe(true)

      // Bucket B is untouched — same key, different bucket
      expect((await checkRateLimit('ip-1', optsB)).limited).toBe(false)
      expect((await checkRateLimit('ip-1', optsB)).remaining).toBe(3)
    })

    it('T-R06: different keys in same bucket are independent', async () => {
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      expect((await checkRateLimit('ip-1', OPTS)).limited).toBe(true)

      // ip-2 has no failures in the same bucket
      expect((await checkRateLimit('ip-2', OPTS)).limited).toBe(false)
      expect((await checkRateLimit('ip-2', OPTS)).remaining).toBe(3)
    })
  })

  describe('__resetAllForTests R-08 NODE_ENV guard', () => {
    it('T-R09: __resetAllForTests throws in production (R-08 ✅ FIXED in <COMMIT_HASH_TBD>)', async () => {
      // FIX EVIDENCE: Phase 1.5.9 R-08 closure. The export is retained
      // (test consumers still need it for cleanup), but production
      // invocation throws. An attacker with supply-chain code-execution
      // capability can no longer call this to silently wipe rate-limit
      // state — the throw produces a visible error instead.
      //
      // MISLABELING HISTORY (resolved): T-R09's original incarnation
      // (Phase 1.D.1) was a gap-doc test mapped to R-08, asserting the
      // function CAN be called from any caller (documenting reachability
      // as an exploit). Phase 1.5.9 flips this to regression guard for
      // the new NODE_ENV-gated behavior.
      //
      // REJECTED ALTERNATIVE: remove __resetAllForTests entirely.
      // Rejected because test/setup.ts global afterEach + this file's
      // beforeEach both rely on it for hermetic test isolation. The
      // export must remain accessible to tests; the production gate
      // is the surgical hardening.
      vi.stubEnv('NODE_ENV', 'production')
      await expect(__resetAllForTests()).rejects.toThrow(/prohibited in production/)
      vi.unstubAllEnvs()
    })

    it('T-R09b: __resetAllForTests works in non-production (test hermeticity preserved)', async () => {
      // Baseline NODE_ENV is 'test' (from setup.ts vi.stubEnv). The reset
      // helper must remain functional in test/dev contexts so the global
      // afterEach + per-file beforeEach can clear state between tests.
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)

      await expect(__resetAllForTests()).resolves.not.toThrow()

      const result = await checkRateLimit('ip-1', OPTS)
      expect(result.remaining).toBe(3) // cleared
    })
  })

  describe('Supabase dispatcher (R-02 ✅ FIXED in <COMMIT_HASH_TBD>)', () => {
    it('T-R10: When Supabase enabled, recordFailure + checkRateLimit dispatch to Supabase backend (cross-instance shared state simulation)', async () => {
      // FIX EVIDENCE: Phase 1.5.9 R-02 closure. The rate-limiter's
      // dispatcher routes calls to supabase-rate-limits.ts module when
      // isSupabaseRateLimitsEnabled() returns true. In production, this
      // means rate-limit state lives in Supabase Postgres
      // (public.rate_limits table) — cross-instance-coherent. The
      // attack vector R-02 documented (per-process Map → Vercel
      // multi-instance budget multiplication) is closed because all
      // instances now read/write the same Postgres row.
      //
      // SIMULATION SCOPE: this is a UNIT-TEST-LEVEL simulation of the
      // shared-state property. We override the Supabase mocks with a
      // shared in-memory Map that simulates Postgres state. Both
      // "instance A" and "instance B" calls go through the same spied
      // backing, proving that the rate-limiter's dispatcher correctly
      // routes through the shared backend. True E2E Postgres testing
      // (separate Node processes hitting real Supabase) is Phase 5
      // integration test scope.
      //
      // SENIOR ARCHITECT NOTE: this test does NOT prove atomicity of the
      // upsert under concurrent load (read-modify-write race tolerance
      // documented in supabase-rate-limits.ts). T-R11 probes that
      // separately at the dispatcher level.
      const sharedStore = new Map<string, { count: number; reset_at: string }>()

      vi.spyOn(supabaseRateLimits, 'isSupabaseRateLimitsEnabled').mockReturnValue(true)
      const recordSpy = vi.spyOn(supabaseRateLimits, 'recordFailureToSupabase').mockImplementation(
        async (bucket: string, key: string, max: number, windowMs: number) => {
          const k = `${bucket}:${key}`
          const now = Date.now()
          const existing = sharedStore.get(k)
          let newCount: number
          let newResetAt: string
          if (!existing || new Date(existing.reset_at).getTime() < now) {
            newCount = 1
            newResetAt = new Date(now + windowMs).toISOString()
          } else {
            newCount = existing.count + 1
            newResetAt = existing.reset_at
          }
          sharedStore.set(k, { count: newCount, reset_at: newResetAt })
          return {
            limited: newCount >= max,
            remaining: Math.max(0, max - newCount),
            resetAt: new Date(newResetAt).getTime(),
          }
        },
      )
      const checkSpy = vi.spyOn(supabaseRateLimits, 'checkRateLimitFromSupabase').mockImplementation(
        async (bucket: string, key: string, max: number) => {
          const k = `${bucket}:${key}`
          const existing = sharedStore.get(k)
          if (!existing) return { limited: false, remaining: max, resetAt: 0 }
          const resetAtMs = new Date(existing.reset_at).getTime()
          if (resetAtMs < Date.now()) return { limited: false, remaining: max, resetAt: 0 }
          return {
            limited: existing.count >= max,
            remaining: Math.max(0, max - existing.count),
            resetAt: resetAtMs,
          }
        },
      )

      // "Instance A" — record 3 failures via the rate-limiter dispatcher.
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)
      await recordFailure('ip-1', OPTS)

      // "Instance B" — checkRateLimit through SAME dispatcher (same
      // spy-backed shared store). Real production would be a different
      // Node process; the unit test simulates the shared state property
      // via the shared map.
      const check = await checkRateLimit('ip-1', OPTS)
      expect(check.limited).toBe(true)
      expect(check.remaining).toBe(0)

      // Verify dispatcher actually routed through Supabase spies (not
      // the fallback globalThis Map path).
      expect(recordSpy).toHaveBeenCalledTimes(3)
      expect(checkSpy).toHaveBeenCalledTimes(1)
    })

    it('T-R11: 10 sequential recordFailure calls all dispatch to Supabase (atomic-tolerant simulation)', async () => {
      // FIX EVIDENCE: Phase 1.5.9 R-02 — verifies dispatcher correctly
      // forwards N calls to the Supabase backend. In production, the
      // backend's read-modify-write pattern (per
      // supabase-rate-limits.ts comment) is race-tolerant (slight
      // under-counting under extreme concurrent load, never
      // over-counting). This test mocks the backend with a sequential
      // counter to prove the dispatcher correctness without asserting
      // strict atomicity (that's a Phase 5 E2E test against real
      // Postgres with concurrent connections).
      //
      // REJECTED ALTERNATIVE: actually parallel-await 10 calls via
      // Promise.all + assert final count === 10. Rejected because the
      // mock implementation uses JS-level shared state (single-threaded
      // event loop) — Promise.all would still serialize the awaits
      // (each await yields control but the mock's count++ is
      // synchronous between yields). The serialized simulation matches
      // the JS event loop's actual behavior, so it's correct, but
      // claiming it proves "atomicity under concurrent load" would
      // overstate what the unit test demonstrates. The honest assertion
      // is "dispatcher forwards all calls; backend accumulates."
      let count = 0
      vi.spyOn(supabaseRateLimits, 'isSupabaseRateLimitsEnabled').mockReturnValue(true)
      const recordSpy = vi.spyOn(supabaseRateLimits, 'recordFailureToSupabase').mockImplementation(
        async (_bucket: string, _key: string, max: number, windowMs: number) => {
          count++
          return {
            limited: count >= max,
            remaining: Math.max(0, max - count),
            resetAt: Date.now() + windowMs,
          }
        },
      )

      const OPTS_10 = { bucket: 'test-parallel', max: 10, windowMs: 60_000 }
      const calls = Array.from({ length: 10 }, () => recordFailure('ip-1', OPTS_10))
      await Promise.all(calls)

      // All 10 calls dispatched to Supabase spy
      expect(recordSpy).toHaveBeenCalledTimes(10)
      // Final count = 10 (no race-condition loss in this serialized simulation)
      expect(count).toBe(10)
    })
  })
})
