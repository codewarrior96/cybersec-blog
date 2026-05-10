// SENIOR ARCHITECT NOTE: reset/validate/route.ts is the simplest auth route in
// Phase 1.D — 84 lines, ONE module dependency (findUserByPasswordResetToken).
// What's NOT imported is as significant as what is: no rate-limiter, no
// client-ip, no audit-log. This absence is the LITERAL EVIDENCE of R-11
// (Medium, A04) — unauthenticated token-validity oracle without rate limit.
// Source comment L24-28 explicitly chooses this design (entropy argument);
// audit Section 2 R-11 documents the residual oracle gap.

vi.mock('@/lib/soc-store-adapter', () => ({
  findUserByPasswordResetToken: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { findUserByPasswordResetToken } from '@/lib/soc-store-adapter'
import { GET } from './route'

function makeGetRequest(opts: { token?: string } = {}): NextRequest {
  const url =
    opts.token !== undefined
      ? `https://localhost/api/auth/reset/validate?token=${encodeURIComponent(opts.token)}`
      : 'https://localhost/api/auth/reset/validate'
  return new NextRequest(url, { method: 'GET' })
}

const FUTURE_ISO = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h
const PAST_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString() // -1h

const validUser = {
  id: 1,
  passwordResetToken: 'token-xyz',
  passwordResetTokenExpiresAt: FUTURE_ISO,
}

beforeEach(() => {
  vi.mocked(findUserByPasswordResetToken).mockResolvedValue(validUser as never)
})

describe('reset/validate/route GET', () => {
  // ─── Happy path (T-RV01) ───────────────────────────────────────────────────

  describe('happy path', () => {
    it('T-RV01: Valid token → 200 valid:true', async () => {
      // SENIOR ARCHITECT NOTE: response contract is unusual — status code
      // is uniformly 200 across ALL paths (valid, invalid, expired, store
      // error). Source comment L18-21 explicit:
      //   "Always returns 200 — the validity is encoded in the body, not
      //   the status code. This avoids treating 'expired' and 'invalid'
      //   as errors (they're expected states) and matches the read-only
      //   nature of the endpoint: a GET request that observes state
      //   without mutating it."
      //
      // BODY FIELD ORACLE NATURE:
      // The validity is encoded in the BODY shape, specifically in the
      // PRESENCE/ABSENCE of the `reason` field:
      //   - valid:   { ok: true, valid: true }                 (NO reason)
      //   - invalid: { ok: true, valid: false, reason: 'invalid' }
      //   - expired: { ok: true, valid: false, reason: 'expired' }
      //
      // The body field is the ONLY oracle channel — status code uniform
      // 200 intentionally kills any status-based oracle. An attacker who
      // observes only the response status learns nothing; an attacker
      // who parses the body learns the validity state.
      //
      // PHASE 1.5 HARDENING (proposal #2 from R-11 mitigation set):
      // generic-200 collapse drops the `reason` field entirely. All
      // invalid/expired/etc. paths return identical { ok: true, valid:
      // false } body. This kills the body-field oracle channel — UX cost
      // is that the user can no longer be told "expired" vs "invalid"
      // at this layer (deferred to /reset POST's distinct error codes).
      //
      // T-RV01 specifically asserts that the valid path produces a body
      // WITHOUT a `reason` field — that absence IS the valid signal.
      // A regression that always includes `reason` (e.g. `reason: null`
      // or `reason: 'valid'`) would silently change the body shape and
      // confuse frontend code that branches on `reason !== undefined`.
      const response = await GET(makeGetRequest({ token: 'token-xyz' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, valid: true })
      // Specifically assert NO `reason` field — absence is the oracle signal
      expect(body.reason).toBeUndefined()
    })
  })

  // ─── Token validation gates (T-RV02-05) ────────────────────────────────────

  describe('token validation gates', () => {
    it('T-RV02: Missing token → 200 valid:false reason:invalid', async () => {
      // L33-39 early-reject. searchParams.get('token') ?? '' → empty
      // string → !token truthy → emit invalid response without consulting
      // the store (no findUserByPasswordResetToken call).
      const response = await GET(makeGetRequest()) // no ?token=

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, valid: false, reason: 'invalid' })
      expect(findUserByPasswordResetToken).not.toHaveBeenCalled()
    })

    it('T-RV03: Token not in store → 200 valid:false reason:invalid', async () => {
      // L43-49 gate. findUserByPasswordResetToken returns null when the
      // token doesn't match any user record — could be: never existed
      // (random attacker probe), tampered, or already consumed by /reset
      // POST (single-use atomic write+clear cleared the token).
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce(null)

      const response = await GET(makeGetRequest({ token: 'unknown-token' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, valid: false, reason: 'invalid' })
    })

    it('T-RV04: expiresAt missing → 200 valid:false reason:invalid (defensive)', async () => {
      // L51-61 defensive gate. User found but passwordResetTokenExpiresAt
      // is null. Source comment L52-55: "Token row exists but expiry was
      // never set — treat as invalid. This shouldn't happen in normal
      // flow (setPasswordResetToken always sets expiresAt) but
      // defensively coercing to invalid is safer than letting a never-
      // expiring token through."
      //
      // Same `reason: 'invalid'` as T-RV02/T-RV03 — distinct gate but
      // bundled error code. Missing-TTL doesn't have a distinct UX
      // recovery (user just sees "invalid, request new link"), so it
      // collapses with the broader invalid bucket.
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce({
        ...validUser,
        passwordResetTokenExpiresAt: null,
      } as never)

      const response = await GET(makeGetRequest({ token: 'token-with-no-ttl' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, valid: false, reason: 'invalid' })
    })

    it('T-RV05: Expired → 200 valid:false reason:expired (distinct UX recovery)', async () => {
      // SENIOR ARCHITECT NOTE: distinct `reason: 'expired'` (vs the
      // 'invalid' bundle in T-RV02/03/04) — UX recovery differential.
      // Frontend renders different messaging:
      //   - expired: "Your link expired. Request a new password reset
      //     email." (CTA: send new email)
      //   - invalid: "This link doesn't look valid. Did you copy-paste
      //     correctly?" (CTA: paste again, or send new email)
      //
      // INPUT ENTROPY SEMANTIC PRINCIPLE (per T-RS06, Phase 1.D.18):
      // High entropy input (256-bit random token) → distinct error
      // codes SAFE because attacker cannot enumerate via the
      // distinction. Compare to forgot/verify-resend which query by
      // EMAIL (low entropy, dictionary-attackable) and MUST collapse
      // to generic-200.
      //
      // Reset/validate is therefore the SECOND deliberate departure
      // from the anti-enumeration BENCHMARK (first: reset POST,
      // T-RS06). Same entropy argument applies — token is high-entropy
      // random hex, distinct error codes are UX-helpful and not an
      // enumeration vector. Phase 1.5 hardening proposal (2) generic-
      // 200 collapse would still make sense for defense-in-depth (kill
      // body-field oracle channel for leaked-token validation, see
      // T-RV07), but it's not strictly required by the entropy
      // argument.
      //
      // The architectural lesson from this test plus T-RS06:
      //   "low entropy input → generic-200 collapse mandatory"
      //   "high entropy input → distinct codes safe AND UX-helpful"
      // These two routes (reset POST + reset/validate GET) share the
      // same input class (token) and the same architectural reasoning.
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce({
        ...validUser,
        passwordResetTokenExpiresAt: PAST_ISO, // expired 1h ago
      } as never)

      const response = await GET(makeGetRequest({ token: 'expired-token' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, valid: false, reason: 'expired' })
    })
  })

  // ─── Safe fallback (T-RV06) ────────────────────────────────────────────────

  describe('safe fallback', () => {
    it('T-RV06: Store throws → 200 valid:false reason:invalid (fail-closed default)', async () => {
      // L73-83 catch fallback. Source comment L75-77: "Treat unexpected
      // internal failures as invalid — the user will see the 'request a
      // new link' UI, which is the safest fallback (vs. showing the form
      // and failing on submit)."
      //
      // FAIL-CLOSED design: an unexpected exception (DB connection blip,
      // findUserByPasswordResetToken throws) is converted to "invalid"
      // rather than 500 INTERNAL. This means the user sees the
      // request-new-link UI instead of a server error page.
      //
      // The tradeoff: this hides internal failures from observability
      // surfaces (the user wouldn't know to file a support ticket about
      // a transient DB issue). Operator-side observability via
      // console.error log only. Phase 1.5 hardening: structured
      // alerting on console.error from this route (same pattern as
      // R-12 hardening proposal in T-VR06/T-FG07).
      vi.mocked(findUserByPasswordResetToken).mockRejectedValueOnce(
        new Error('store unreachable'),
      )
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await GET(makeGetRequest({ token: 'any-token' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, valid: false, reason: 'invalid' })

      // console.error captured for operator forensics
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  // ─── R-11 unauthenticated token-validity oracle ───────────────────────────

  describe('R-11 unauthenticated token-validity oracle', () => {
    it('T-RV07: No rate limit on validate endpoint — high-speed probing not throttled (R-11)', async () => {
      // SENIOR ARCHITECT NOTE: R-11 (Medium, A04) — LITERAL gap test.
      // Source comment L24-28: "No rate limit at this layer — the
      // /api/auth/reset POST that consumes the token IS rate-limited
      // implicitly via the 1h token TTL." Audit Section 2 R-11 codifies
      // this as a gap with severity Medium.
      //
      // R-11 has TWO SUB-VECTORS:
      //
      // (a) BRUTE-FORCE VECTOR — entropy-bound, theoretical only.
      //     Attacker probes /reset/validate?token=<random> hoping to
      //     hit a valid token. Token is 32-byte random hex (256-bit
      //     entropy). Even at 1M req/sec, 2^256 / 1M ≈ 2^222 seconds
      //     — astronomically infeasible. Brute force is theoretically
      //     possible (no rate limit) but practically zero risk thanks
      //     to entropy. Severity contribution: negligible.
      //
      // (b) LEAKED-TOKEN-VALIDATION VECTOR — real risk, Medium severity.
      //     Attacker has SOME suspect tokens from out-of-band leakage:
      //       - Server logs leaked (Sentry/ELK misconfig captured the
      //         ?token=... query param; vendor breach exposed log
      //         archive; support-ticket screenshot leaked URL bar)
      //       - Phishing chain: fake reset email → victim clicks →
      //         attacker observes via shoulder-surf, malicious browser
      //         extension, MITM proxy, screen recording
      //       - Browser history dump on shared/public devices
      //     Attacker probes /reset/validate to confirm which leaked
      //     tokens are still within the 1h TTL window before launching
      //     the actual /reset POST exploit. The unauthenticated oracle
      //     accelerates the attack pipeline — without it, the attacker
      //     would have to test each token via /reset POST (which IS
      //     rate-limited and consumes the token, exposing the attacker
      //     after the first try).
      //
      // FOUR HARDENING PROPOSALS (each addresses a different sub-vector):
      //
      // (1) IP-keyed rate limit (e.g., 30/5min):
      //     Sub-vector (a): cosmetic — already entropy-bound, doesn't
      //                     meaningfully change brute-force feasibility
      //     Sub-vector (b): scale-reducer — attacker with 100 leaked
      //                     tokens can probe ~30/5min/IP, slows but
      //                     doesn't eliminate. Pairs poorly with R-01
      //                     (IP rotation bypass) — combined IP+token
      //                     rate-limit would be stronger.
      //
      // (2) Generic-200 collapse (drop `reason` field):
      //     Sub-vector (a): no impact — brute force still works the
      //                     same way (just learn valid:bool instead of
      //                     valid:bool + reason)
      //     Sub-vector (b): scope-killer — attacker with leaked tokens
      //                     can no longer distinguish "valid" from
      //                     "expired but-was-once-valid" via this
      //                     endpoint. Reduces oracle precision.
      //                     UX cost: pre-check UI loses ability to
      //                     show specific error message.
      //
      // (3) Token consume on validate (change GET to POST):
      //     Sub-vector (a): no impact (still entropy-bound)
      //     Sub-vector (b): SCOPE-KILLER — attacker can probe each
      //                     leaked token AT MOST ONCE. After probing,
      //                     the token is consumed and unusable for the
      //                     real /reset attack. UX cost: pre-check
      //                     becomes a destructive action; user can't
      //                     refresh the page to re-validate.
      //
      // (4) Combine (1) + (2):
      //     Sub-vector (a): cosmetic
      //     Sub-vector (b): both rate AND oracle precision reduced.
      //                     Best balance of UX preservation and
      //                     defense-in-depth.
      //
      // REJECTED ALTERNATIVE for R-11 oracle test design: probe via
      // timing only (DB-hit path slower than no-DB path). Rejected —
      // body field differential is the EASIER oracle (no timing
      // measurement needed; works in single request). Status code is
      // intentionally uniform 200 (source comment L18-21), so the body
      // field is the only oracle channel. Timing oracle exists but is
      // strictly weaker than the body oracle for an attacker.
      //
      // T-RV07 EMPIRICAL PROOF:
      //   - 15 sequential probe calls (would be 429 if rate limit
      //     existed at any reasonable threshold)
      //   - All return 200 (no throttling)
      //   - Body field differential persists across all probes
      //     (oracle works on every request)
      //   - findUserByPasswordResetToken called N times, no rate-limit
      //     module imported (the absence is structural)
      //
      // Hardening landing: when proposal (3) lands (token consume on
      // validate), this test must flip to expect failure on the second
      // call with the same token — single-use enforcement converts the
      // probe into a destructive action.

      // Rapid-fire 15 probes on the same valid token
      const N = 15
      const responses: Response[] = []
      for (let i = 0; i < N; i++) {
        responses.push(await GET(makeGetRequest({ token: 'token-xyz' })))
      }

      // PROOF (1): all N return 200 — no 429 throttling triggered
      for (const r of responses) {
        expect(r.status).toBe(200)
      }

      // PROOF (2): body oracle persists — every probe returns the same
      // distinguishable {valid:true} body
      const bodies = await Promise.all(responses.map((r) => r.json()))
      for (const b of bodies) {
        expect(b).toEqual({ ok: true, valid: true })
      }

      // PROOF (3): findUserByPasswordResetToken called N times — store
      // hit per request, no caching/throttling layer
      expect(findUserByPasswordResetToken).toHaveBeenCalledTimes(N)

      // PROOF (4): body field differential is the oracle channel —
      // probe with INVALID token returns distinct body shape
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce(null)
      const invalidProbe = await GET(makeGetRequest({ token: 'unknown-token' }))
      const invalidBody = await invalidProbe.json()
      expect(invalidBody).toEqual({ ok: true, valid: false, reason: 'invalid' })

      // ORACLE PROVEN: attacker can distinguish valid from invalid
      // tokens via body field differential, no rate limit to slow them
      // down. Only entropy-bound brute force is impractical; targeted
      // leaked-token validation (sub-vector b) remains the real risk.
    })
  })
})
