import { DUMMY_PASSWORD_HASH, SCRYPT_N, hashPassword, verifyPassword } from './security'

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

    it('T-S09: truncated hashHex rejected by verifyPassword (R-21 FIXED in ed403df)', () => {
      // FIX EVIDENCE: Phase 1.5.4 R-21 — verifyPassword now invokes
      // assertHashFormat(storedHash) as its first action inside the
      // try-block (security.ts read-time guard). A truncated hashHex
      // no longer matches the HASH_FORMAT_RE invariant
      // /^[0-9a-f]{32}:[0-9a-f]{128}$/, assertHashFormat throws, the
      // surrounding try-catch returns false. Net behavior: truncated
      // stored hash → verifyPassword returns false → caller sees
      // "wrong password" identically to any other auth failure.
      //
      // MISLABELING HISTORY: this test was originally tagged "(gap,
      // R-07)" in its title and mapped to R-07 in audit Section 5
      // (L98). The test body actually probed R-21's vector —
      // truncated hash acceptance via the L19 dead-code path — NOT
      // R-07's scrypt cost parameter (N=16384 vs 32768). The mislabel
      // was acknowledged in amendment A-02 ("T-S09 currently
      // documents the L19 dead-code gap. R-21 is downstream").
      // Section 5 mapping corrected to R-21 during Phase 1.5.4 R-21
      // fix commit; T-S09 body flipped from gap-documenting
      // `.toBe(true)` to regression-guard `.toBe(false)`.
      //
      // SENIOR ARCHITECT NOTE: the previous test header described the
      // L19 length comparison as "dead code" — that observation
      // stands. The R-21 fix does NOT make L19 reachable (scryptSync
      // still derives output to expected.length, so actual.length
      // still equals expected.length post-derive). Instead, the new
      // assertHashFormat call SHORT-CIRCUITS the entire derive step
      // when the stored hash is malformed — closing R-21 at a
      // strictly upstream point. L19 remains dead but harmless.
      //
      // REJECTED ALTERNATIVE: rewrite verifyPassword to call
      // scryptSync(password, salt, SCRYPT_KEY_LENGTH) (full length,
      // not expected.length), then truly compare lengths at L19.
      // Rejected because it would not protect against a stored hash
      // that's the WRONG length-but-not-shorter (e.g., extra bytes
      // appended, valid-but-truncated middle, completely different
      // encoding). Format-regex assertion catches the broader class
      // of malformed inputs in one check.
      const hash = hashPassword('somepassword')
      const [saltHex, hashHex] = hash.split(':')
      const truncated = `${saltHex}:${hashHex.slice(0, -8)}`
      expect(verifyPassword('somepassword', truncated)).toBe(false)
    })

    it('T-S13: hashPassword output conforms to invariant; verifyPassword rejects multiple malformed shapes (R-21 FIXED in ed403df)', () => {
      // FIX EVIDENCE: Phase 1.5.4 R-21 write-time + read-time invariant
      // probe. Three layers of regression coverage:
      //
      //   Probe 1 — hashPassword output ALWAYS matches HASH_FORMAT_RE.
      //   Tautological by construction (randomBytes(16) → 32 hex,
      //   scryptSync(...64) → 128 hex) but tripwires any future
      //   regression that alters hashPassword's output shape.
      //
      //   Probe 2 — 10 varying inputs all conform. Confirms randomBytes
      //   doesn't drift outside the invariant across iterations.
      //
      //   Probe 3 — multiple malformed storedHash shapes all route to
      //   verifyPassword false-return. Covers shapes that DON'T fail
      //   the pre-existing L48 `!saltHex || !hashHex` short-circuit
      //   (which already caught missing-colon / empty-halves), but
      //   DO fail the new HASH_FORMAT_RE assertion.
      //
      // R-04 two-layer test architecture pattern (T-LG12 route shape +
      // T-S12 library timing): now T-S09 read-time regression guard +
      // T-S13 write-time conformance + multi-shape read-time guard.
      //
      // SENIOR ARCHITECT NOTE: assertHashFormat is deliberately NOT
      // exported (it's a security.ts-internal helper). This test
      // probes its contract INDIRECTLY via hashPassword's
      // self-validation (smoke probes 1+2) and verifyPassword's
      // false-return on malformed input (probe 3). Indirect testing
      // proves the SAME function instance is enforcing the invariant
      // in both hashPassword and verifyPassword call paths — a single
      // chokepoint contract.
      //
      // REJECTED ALTERNATIVE: export assertHashFormat for direct unit
      // testing. Rejected because exposing it would invite external
      // caller-side validation drift (callers should never need to
      // validate hashes — they get them from hashPassword
      // self-validated or read them from storage where verifyPassword
      // performs the validation).

      // Probe 1: hashPassword output matches the invariant.
      const output = hashPassword('any-test-password')
      expect(output).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)

      // Probe 2: 10 varying inputs all conform.
      for (let i = 0; i < 10; i++) {
        expect(hashPassword(`probe-${i}`)).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
      }

      // Probe 3: deliberately-malformed storedHash shapes route to
      // verifyPassword false-return. Each probe targets a DIFFERENT
      // class of malformation that survives the pre-existing L48
      // short-circuit but is caught by the new assertHashFormat.
      const validSalt = '0'.repeat(32)
      const validHash = '0'.repeat(128)
      // 3a: uppercase hex (Buffer.from accepts but invariant requires lowercase)
      expect(verifyPassword('any', `ABCDEF1234567890ABCDEF1234567890:${validHash}`)).toBe(false)
      // 3b: salt correct length, hash truncated (the R-21 vector itself)
      expect(verifyPassword('any', `${validSalt}:${'0'.repeat(120)}`)).toBe(false)
      // 3c: salt wrong length (too short), hash correct length
      expect(verifyPassword('any', `${'0'.repeat(24)}:${validHash}`)).toBe(false)
      // 3d: non-hex char in hashHex
      expect(verifyPassword('any', `${validSalt}:${'x'.repeat(128)}`)).toBe(false)
      // 3e: extra bytes appended to hashHex (not a truncation, but still malformed)
      expect(verifyPassword('any', `${validSalt}:${validHash}00`)).toBe(false)
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
      //   - Threshold: max(40ms, 0.35 * avg_arm_time) — widened in Phase
      //     1.5.11 (R-07 commit db48dfd) for SCRYPT_N=32768
      //     2× cost. Doubling absolute scrypt CPU time roughly doubles
      //     jitter window per call; threshold ratchet absorbs the
      //     amplification without compromising parity-regression-guard
      //     semantics. Prior threshold max(20ms, 0.3 * avg) was tuned for
      //     N=16384's ~50ms baseline; at N=32768's ~100ms baseline, the
      //     0.3 * 100ms = 30ms band could yield false positives under CI
      //     load. Widening to (40ms, 0.35 * avg) = max(40ms, ~35ms) =
      //     40ms preserves the catch-radius of a genuine parity break
      //     (e.g., DUMMY_PASSWORD_HASH using N=16384 while real hashes
      //     use N=32768 → ~50ms delta, well above 40ms threshold).
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
      const threshold = Math.max(40, 0.35 * avgArmTime)
      const delta = Math.abs(realMedian - dummyMedian)
      expect(delta).toBeLessThan(threshold)
    })

    it('T-S15: SCRYPT_N >= 32768 (R-07 cost-parameter regression guard, FIXED in db48dfd)', () => {
      // FIX EVIDENCE: Phase 1.5.11 R-07 — scrypt cost parameter bumped
      // from Node default N=16384 to OWASP 2024+ recommended N=32768.
      // This test guards against future downgrade — if SCRYPT_N is ever
      // reduced below 32768 (e.g., performance-motivated downgrade
      // without security review), the assertion fires.
      //
      // SENIOR ARCHITECT NOTE: SCRYPT_N exported from security.ts solely
      // for this regression guard. Production code uses the local
      // constant; the export exists for testability without exposing
      // a getter function.
      //
      // REJECTED ALTERNATIVE: exact-equal assertion (SCRYPT_N === 32768).
      // Rejected because OWASP recommendations escalate over time —
      // future cycles may bump to N=65536 or higher. >= 32768 expresses
      // the actual policy ("at least the current OWASP minimum") rather
      // than locking to a specific value that would need test updates
      // on every cost bump.
      expect(SCRYPT_N).toBeGreaterThanOrEqual(32768)
    })
  })
})
