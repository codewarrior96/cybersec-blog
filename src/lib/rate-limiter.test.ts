import { checkRateLimit, recordFailure, clearAttempts, __resetAllForTests } from './rate-limiter'

// SENIOR ARCHITECT NOTE: __resetAllForTests in beforeEach (in addition to global afterEach
// in setup.ts) protects against within-file state leakage. Each test mutates globalThis
// bucket state; without reset, earlier tests corrupt later ones.
// REJECTED ALTERNATIVE: rely solely on global afterEach — if a test throws mid-execution,
// the next test in the same file may start before cleanup completes in some Vitest versions.
beforeEach(() => {
  __resetAllForTests()
})

const OPTS = { bucket: 'test', max: 3, windowMs: 60_000 }

describe('rate-limiter', () => {
  describe('checkRateLimit', () => {
    it('T-R01: first request returns limited=false, remaining=max', () => {
      const result = checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })

    it('T-R08: checkRateLimit is idempotent — does not increment count', () => {
      // Call checkRateLimit multiple times; remaining must not decrease.
      checkRateLimit('ip-1', OPTS)
      checkRateLimit('ip-1', OPTS)
      const result = checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })
  })

  describe('recordFailure', () => {
    it('T-R07: recordFailure decrements remaining on each call', () => {
      const r1 = recordFailure('ip-1', OPTS)
      expect(r1.remaining).toBe(2)
      const r2 = recordFailure('ip-1', OPTS)
      expect(r2.remaining).toBe(1)
      const r3 = recordFailure('ip-1', OPTS)
      expect(r3.remaining).toBe(0)
    })

    it('T-R02: after max recordFailure calls, limited=true', () => {
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      const result = checkRateLimit('ip-1', OPTS)
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

    it('T-R03: after window expiry (vi.advanceTimersByTime), returns limited=false', () => {
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)

      // Confirm limited before expiry
      expect(checkRateLimit('ip-1', OPTS).limited).toBe(true)

      // Advance past the window
      vi.advanceTimersByTime(60_001)

      const result = checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })
  })

  describe('clearAttempts', () => {
    it('T-R04: clearAttempts resets counter for the key', () => {
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      expect(checkRateLimit('ip-1', OPTS).limited).toBe(true)

      clearAttempts('ip-1', OPTS.bucket)

      const result = checkRateLimit('ip-1', OPTS)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(3)
    })
  })

  describe('isolation', () => {
    it('T-R05: different bucket names are independent', () => {
      const optsA = { bucket: 'bucket-a', max: 3, windowMs: 60_000 }
      const optsB = { bucket: 'bucket-b', max: 3, windowMs: 60_000 }

      recordFailure('ip-1', optsA)
      recordFailure('ip-1', optsA)
      recordFailure('ip-1', optsA)
      expect(checkRateLimit('ip-1', optsA).limited).toBe(true)

      // Bucket B is untouched — same key, different bucket
      expect(checkRateLimit('ip-1', optsB).limited).toBe(false)
      expect(checkRateLimit('ip-1', optsB).remaining).toBe(3)
    })

    it('T-R06: different keys in same bucket are independent', () => {
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      recordFailure('ip-1', OPTS)
      expect(checkRateLimit('ip-1', OPTS).limited).toBe(true)

      // ip-2 has no failures in the same bucket
      expect(checkRateLimit('ip-2', OPTS).limited).toBe(false)
      expect(checkRateLimit('ip-2', OPTS).remaining).toBe(3)
    })
  })

  describe('__resetAllForTests', () => {
    it('T-R09: __resetAllForTests clears all buckets (R-08: reachability gap documented)', () => {
      // Populate state across two distinct buckets to prove the reset is global,
      // not scoped to a single bucket.
      //
      // R-08 GAP: __resetAllForTests is exported from the production module without a
      // NODE_ENV guard. A supply-chain compromise with code-execution capability could
      // call this to wipe rate-limit state, bypassing brute-force protection. Requires
      // prior code-execution (not a remote vector), but the export is unnecessarily
      // accessible in production builds.
      const optsA = { bucket: 'bucket-a', max: 3, windowMs: 60_000 }
      const optsB = { bucket: 'bucket-b', max: 3, windowMs: 60_000 }

      recordFailure('ip-1', optsA)
      recordFailure('ip-1', optsA)
      recordFailure('ip-1', optsA)
      recordFailure('ip-2', optsB)
      recordFailure('ip-2', optsB)
      recordFailure('ip-2', optsB)

      expect(checkRateLimit('ip-1', optsA).limited).toBe(true)
      expect(checkRateLimit('ip-2', optsB).limited).toBe(true)

      __resetAllForTests()

      expect(checkRateLimit('ip-1', optsA).limited).toBe(false)
      expect(checkRateLimit('ip-1', optsA).remaining).toBe(3)
      expect(checkRateLimit('ip-2', optsB).limited).toBe(false)
      expect(checkRateLimit('ip-2', optsB).remaining).toBe(3)
    })
  })
})
