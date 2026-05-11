import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './security'

describe('security', () => {
  describe('hashPassword', () => {
    it('T-S01: hashPassword returns salt:hash with 32-char salt hex', () => {
      const result = hashPassword('somepassword')
      const [saltHex, hashHex] = result.split(':')
      expect(saltHex).toHaveLength(32)
      expect(hashHex).toHaveLength(128)
      expect(result).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    })

    it('T-S08: two hashes of same password produce different salts', () => {
      const hash1 = hashPassword('samepassword')
      const hash2 = hashPassword('samepassword')
      const salt1 = hash1.split(':')[0]
      const salt2 = hash2.split(':')[0]
      expect(salt1).not.toBe(salt2)
    })
  })

  describe('verifyPassword', () => {
    it('T-S02: verifyPassword returns true for correct password', () => {
      const hash = hashPassword('correctpassword')
      expect(verifyPassword('correctpassword', hash)).toBe(true)
    })

    it('T-S03: verifyPassword returns false for wrong password', () => {
      const hash = hashPassword('correctpassword')
      expect(verifyPassword('wrongpassword', hash)).toBe(false)
    })

    it('T-S04: verifyPassword returns false for empty stored hash', () => {
      expect(verifyPassword('anypassword', '')).toBe(false)
    })

    it('T-S05: verifyPassword returns false for hash without colon separator', () => {
      expect(verifyPassword('anypassword', 'noseparatorhere')).toBe(false)
    })

    it('T-S06: verifyPassword returns false for non-hex salt', () => {
      // Non-hex salt causes Buffer.from to produce unexpected bytes or throw;
      // the catch block returns false either way.
      expect(verifyPassword('anypassword', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:abcd')).toBe(false)
    })

    it('T-S07: verifyPassword returns false for empty password', () => {
      const hash = hashPassword('correctpassword')
      expect(verifyPassword('', hash)).toBe(false)
    })

    it('T-S09: truncated hashHex passes verification — L19 length guard is dead code (gap, R-07)', () => {
      // GAP DOCUMENTATION: audit assumed verifyPassword returns false for a truncated
      // stored hash. Actual behavior: scryptSync(password, salt, expected.length) always
      // produces exactly expected.length bytes, so actual.length === expected.length always.
      // L19 (`if (actual.length !== expected.length) return false`) is therefore unreachable
      // dead code in this implementation.
      //
      // Consequence: a truncated hash is accepted as valid — the first N bytes of the scrypt
      // output match the first N bytes stored. This is a real gap: an attacker who can write
      // a shortened hash to storage can authenticate with any password whose first-N-byte
      // scrypt output matches. Requires prior storage write access (not a remote vector), but
      // is worth tracking for the hardening backlog.
      //
      // This test asserts the CURRENT behavior (true) as a regression guard. If a future
      // refactor switches to scryptSync(password, salt, SCRYPT_KEY_LENGTH) and then
      // compares against the stored hash, a length mismatch would correctly return false —
      // and this test would catch the regression in either direction.
      const hash = hashPassword('somepassword')
      const [saltHex, hashHex] = hash.split(':')
      const truncated = `${saltHex}:${hashHex.slice(0, -8)}`
      expect(verifyPassword('somepassword', truncated)).toBe(true) // gap: should be false
    })
  })

  // ─── DUMMY_PASSWORD_HASH (R-04 timing equalization) ─────────────────────────

  describe('DUMMY_PASSWORD_HASH (R-04 FIXED in 9b36288)', () => {
    it('T-S10: DUMMY_PASSWORD_HASH is a parseable salt:hash hex pair', () => {
      // FIX EVIDENCE: Phase 1.5.3 R-04 — store authenticateUser
      // implementations route the unknown-user branch through
      // verifyPassword(input, DUMMY_PASSWORD_HASH) to equalize scrypt
      // cost. The constant MUST be a valid stored-hash shape (salt:hash,
      // both hex, both non-empty) — otherwise verifyPassword's L13
      // short-circuit `if (!saltHex || !hashHex) return false` would
      // bypass the scrypt invocation and R-04 would remain exploitable
      // (unknown-user branch returns in ~0ms vs ~50ms for matched).
      const [saltHex, hashHex] = DUMMY_PASSWORD_HASH.split(':')
      expect(saltHex).toMatch(/^[0-9a-f]+$/)
      expect(hashHex).toMatch(/^[0-9a-f]+$/)
      expect(saltHex.length).toBe(32) // 16 bytes hex-encoded
      expect(hashHex.length).toBe(128) // SCRYPT_KEY_LENGTH (64) hex-encoded
    })

    it('T-S11: verifyPassword against DUMMY_PASSWORD_HASH returns false for arbitrary attacker input', () => {
      // FIX EVIDENCE: the dummy hash exists for timing equalization,
      // not authentication. By construction, the salt-derivation path
      // for any real user record uses randomBytes(16) (hashPassword L6),
      // so no real user's stored hash collides with DUMMY_PASSWORD_HASH
      // (zero salt + sentinel derived). Probing the dummy with arbitrary
      // attacker-controlled inputs MUST return false — guards against a
      // regression where the dummy mechanism accidentally accepts user
      // input as a valid credential.
      //
      // NOTE: we deliberately do NOT probe with the sentinel password
      // 'siberlab-r04-dummy-password'. That value IS reachable as a
      // verify-true case (input === sentinel, salt === DUMMY_SALT →
      // scrypt output matches DUMMY_DERIVED by construction). This is
      // benign in practice because (a) the sentinel is not exposed via
      // any user-facing surface, (b) the unknown-user branch in
      // authenticateUser discards the verify result and always returns
      // null, and (c) DUMMY_PASSWORD_HASH is never assigned to a real
      // user record. Asserting false on the sentinel would be a
      // misleading invariant.
      expect(verifyPassword('attacker', DUMMY_PASSWORD_HASH)).toBe(false)
      expect(verifyPassword('', DUMMY_PASSWORD_HASH)).toBe(false)
      expect(verifyPassword('correctpassword', DUMMY_PASSWORD_HASH)).toBe(false)
    })

    it('T-S12: verifyPassword timing parity — DUMMY_PASSWORD_HASH ≈ real hash (R-04 regression guard)', () => {
      // FIX EVIDENCE: Phase 1.5.3 R-04 — the dummy hash MUST consume the
      // same ~50ms scrypt CPU cost as a real stored hash, otherwise the
      // unknown-user branch in authenticateUser still leaks timing.
      //
      // Statistical design (per Phase 1.5.3 brief Section 1 #3):
      //   - N=20 iterations per arm to absorb scrypt jitter
      //   - Median (not mean) — robust to GC stalls / OS scheduling
      //     outliers
      //   - Threshold: max(20ms, 0.3 * avg_arm_time) — loose enough for
      //     CI stability per mentor's explicit "threshold chosen for CI
      //     stability not theoretical tightness" guidance.
      //
      // SENIOR ARCHITECT NOTE: this test exercises REAL scrypt (no mocks
      // at this layer) so the timing measurement is meaningful.
      // Comparing the mock-resolution latency in route.test.ts T-LG12
      // would not be — that's why T-LG12 stays a response-shape guard
      // (route-level enumeration vector) and the library-level timing
      // invariant lives here. Defense-in-depth: two distinct invariants,
      // two distinct tests.
      //
      // REJECTED ALTERNATIVE: assert absolute timing (e.g., both >40ms).
      // Rejected because absolute thresholds drift across CI runner
      // specs (slow runners: 70ms; fast: 30ms). Relative parity is the
      // invariant that closes R-04, regardless of absolute scrypt cost.
      //
      // REJECTED ALTERNATIVE: smaller N (e.g., N=5). Rejected because
      // scrypt single-call jitter is ~5-10ms on a typical machine; with
      // N=5 the median is dominated by outliers. N=20 puts the median
      // in a stable bucket. Cost: ~2s of CPU per test run (40 scrypts ×
      // ~50ms each). Acceptable for a once-per-suite regression guard.
      const N = 20
      const realHash = hashPassword('correctpassword')
      const realTimes: number[] = []
      const dummyTimes: number[] = []
      // Interleave the arms so any monotonic drift (CPU thermal
      // throttle, GC pressure ramp) hits both arms symmetrically.
      for (let i = 0; i < N; i++) {
        const t1 = performance.now()
        verifyPassword('attacker-pwd', realHash)
        realTimes.push(performance.now() - t1)
        const t2 = performance.now()
        verifyPassword('attacker-pwd', DUMMY_PASSWORD_HASH)
        dummyTimes.push(performance.now() - t2)
      }
      realTimes.sort((a, b) => a - b)
      dummyTimes.sort((a, b) => a - b)
      const realMedian = realTimes[Math.floor(N / 2)]
      const dummyMedian = dummyTimes[Math.floor(N / 2)]
      const avgArmTime = (realMedian + dummyMedian) / 2
      const threshold = Math.max(20, 0.3 * avgArmTime)
      const delta = Math.abs(realMedian - dummyMedian)
      expect(delta).toBeLessThan(threshold)
    })
  })
})
