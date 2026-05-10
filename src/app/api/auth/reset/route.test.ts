// SENIOR ARCHITECT NOTE: reset/route.ts is the COMPOSITE auth route — combines
// patterns from verify (token validation gates), register (password validation +
// scrypt avoidance), login (IP-keyed rate-limit), and introduces NEW session-
// invalidation pattern (deleteAllSessionsForUser on password reset). 8 module
// dependencies, 11 audit-listed tests. identity-validation REAL (Phase 1.D.3
// unit-tested); all others mocked at module boundary.

vi.mock('@/lib/soc-store-adapter', () => ({
  findUserByPasswordResetToken: vi.fn(),
  consumePasswordResetToken: vi.fn(),
  deleteAllSessionsForUser: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/security', () => ({
  hashPassword: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/client-ip', () => ({
  getClientIp: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))

import { NextRequest } from 'next/server'
import {
  findUserByPasswordResetToken,
  consumePasswordResetToken,
  deleteAllSessionsForUser,
  writeAuditLog,
} from '@/lib/soc-store-adapter'
import { hashPassword } from '@/lib/security'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { getClientIp } from '@/lib/client-ip'
import { getRequestMetadata } from '@/lib/auth-server'
import { POST } from './route'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/auth/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const FUTURE_ISO = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h
const PAST_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString() // -1h

const validUser = {
  id: 1,
  username: 'u1',
  displayName: 'U1',
  email: 'u@example.com',
  role: 'viewer' as const,
  passwordResetToken: 'token-xyz',
  passwordResetTokenExpiresAt: FUTURE_ISO,
}

const updatedUser = {
  id: 1,
  username: 'u1',
  email: 'u@example.com',
}

const validBody = { token: 'token-xyz', newPassword: 'newpass1234' }

beforeEach(() => {
  vi.mocked(getClientIp).mockReturnValue('127.0.0.1')
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(checkRateLimit).mockReturnValue({
    limited: false,
    remaining: 9,
    resetAt: Date.now() + 5 * 60 * 1000,
  })
  vi.mocked(hashPassword).mockReturnValue('hashed:value')
  vi.mocked(findUserByPasswordResetToken).mockResolvedValue(validUser as never)
  vi.mocked(consumePasswordResetToken).mockResolvedValue(updatedUser as never)
  vi.mocked(deleteAllSessionsForUser).mockResolvedValue({ deletedCount: 2 } as never)
  vi.mocked(writeAuditLog).mockResolvedValue(undefined as never)
})

describe('reset/route POST', () => {
  // ─── Happy path + session invalidation (T-RS01, T-RS10) ────────────────────

  describe('happy path + session invalidation', () => {
    it('T-RS01: Valid token + valid pw → 200, sessions deleted, audit logged', async () => {
      // SENIOR ARCHITECT NOTE: success contract has THREE invariants:
      //   (1) Response 200 + body.ok=true + Turkish "Şifren güncellendi"
      //       message (UI displays + redirects to login)
      //   (2) deleteAllSessionsForUser called with user.id (every active
      //       session for the user invalidated — see T-RS10 for the
      //       focused assertion). PATTERN: GitHub/banking — password
      //       reset is treated as a potential compromise signal, so
      //       all sessions are killed regardless of where they came
      //       from. The user is forced to log in fresh on every device,
      //       which means an attacker who hijacked one session loses
      //       access immediately even if the original credentials
      //       leaked separately.
      //   (3) writeAuditLog called with action='auth.password_reset' +
      //       details.sessionsInvalidated populated (forensic record
      //       captures both the action AND its blast radius — how many
      //       sessions were killed, useful for incident response).
      //
      // Phase 1.5 hardening backlog: consider extending session
      // invalidation to password CHANGE (not just reset). Currently if
      // a user changes their password from settings (vs forgot →
      // reset), other sessions remain valid. Could be a gap depending
      // on threat model — typed-password-change is a weaker compromise
      // signal than reset-token consumption, but still warrants killing
      // sessions per defense-in-depth.
      const response = await POST(makePostRequest(validBody))

      // (1) Response shape
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.message).toContain('Şifren güncellendi')

      // (2) Session invalidation
      expect(deleteAllSessionsForUser).toHaveBeenCalledOnce()
      expect(deleteAllSessionsForUser).toHaveBeenCalledWith(updatedUser.id)

      // (3) Audit log with action + details.sessionsInvalidated
      expect(writeAuditLog).toHaveBeenCalledOnce()
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: updatedUser.id,
          action: 'auth.password_reset',
          entityType: 'user',
          entityId: updatedUser.id,
          details: expect.objectContaining({ sessionsInvalidated: 2 }),
        }),
      )

      // Token consumed atomically (single-use lifecycle)
      expect(consumePasswordResetToken).toHaveBeenCalledOnce()
      expect(consumePasswordResetToken).toHaveBeenCalledWith(validUser.id, 'hashed:value')
    })

    it('T-RS10: Success → deleteAllSessionsForUser called with user.id', async () => {
      // SENIOR ARCHITECT NOTE: focused assertion on the session-
      // invalidation contract. T-RS01 covers the broader 3-invariant
      // success contract; T-RS10 narrowly probes the
      // deleteAllSessionsForUser call.
      //
      // PATTERN: "password reset = potential compromise → all sessions
      // killed" (GitHub, AWS Cognito, Auth0, banking flows). The
      // assumption is that a forgotten-password event is statistically
      // correlated with credential compromise (phishing, shared
      // password, breach reuse). Even when the user genuinely forgot
      // their password, killing all sessions is cheap (re-login) and
      // closes the attacker-rides-with-victim window. Net positive
      // security tradeoff.
      //
      // The deletedCount return value is captured in audit log details
      // (T-RS01 covers that). Here we just verify the call happened
      // with the correct user.id.
      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      expect(deleteAllSessionsForUser).toHaveBeenCalledOnce()
      expect(deleteAllSessionsForUser).toHaveBeenCalledWith(updatedUser.id)
    })
  })

  // ─── Input validation (early reject before scrypt) ─────────────────────────

  describe('input validation (early reject before scrypt)', () => {
    it('T-RS02: Missing token → 400 TOKEN_INVALID', async () => {
      const response = await POST(makePostRequest({ ...validBody, token: '' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('TOKEN_INVALID')
      expect(body.ok).toBe(false)

      // Recorded for rate-limit accounting
      expect(recordFailure).toHaveBeenCalledOnce()
      // Scrypt + DB short-circuited
      expect(hashPassword).not.toHaveBeenCalled()
      expect(findUserByPasswordResetToken).not.toHaveBeenCalled()
    })

    it('T-RS03: Token > 256 chars → 400 TOKEN_INVALID', async () => {
      // Source L79: `!token || token.length > MAX_TOKEN_LENGTH` (256).
      // Cap exists to prevent attacker from posting megabytes-of-token
      // payloads that would force the store to scan/hash long input.
      const response = await POST(makePostRequest({ ...validBody, token: 'a'.repeat(257) }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('TOKEN_INVALID')
      expect(recordFailure).toHaveBeenCalledOnce()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(findUserByPasswordResetToken).not.toHaveBeenCalled()
    })

    it('T-RS04: Weak pw → 400 WEAK_PASSWORD, scrypt not called', async () => {
      // SENIOR ARCHITECT NOTE: response correctness PRIMARY assertion;
      // scrypt-not-called as secondary (DoS-guard side effect). T-RS11
      // is the dedicated DoS-guard regression test with the
      // scrypt-not-called assertion as PRIMARY focus.
      //
      // T-RS04 here verifies:
      //   - 400 status code (not 500, not 200)
      //   - body.error === 'WEAK_PASSWORD'
      //   - body.message contains the localized password error string
      //     (from getPasswordError() — UX surfaces specific advice)
      const response = await POST(
        makePostRequest({ ...validBody, newPassword: '1234567' }), // 7 chars, below 8-char min
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('WEAK_PASSWORD')
      expect(body.message).toBeTruthy() // localized error from getPasswordError()
      expect(recordFailure).toHaveBeenCalledOnce()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(findUserByPasswordResetToken).not.toHaveBeenCalled()
    })
  })

  // ─── Token validation gates ────────────────────────────────────────────────

  describe('token validation gates', () => {
    it('T-RS05: Token not in store → 400 TOKEN_INVALID', async () => {
      // L100 gate. findUserByPasswordResetToken returned null —
      // could be: never existed (random attacker guess), tampered
      // (truncated), or already consumed (single-use enforced by
      // store-layer atomic write+clear in consumePasswordResetToken).
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('TOKEN_INVALID')
      expect(recordFailure).toHaveBeenCalledOnce()
      // hashPassword NOT called — token rejection happens BEFORE the
      // hash step (L99 < L128). Wait, actually source flow:
      //   L90: password validation (passes for valid pw)
      //   L99: token DB lookup
      //   L100: !user → reject (no hashing yet)
      //   L128: hashPassword
      // So when token-not-found, password was already validated but
      // hashing hasn't happened. consumePasswordResetToken not called
      // because user is null.
      expect(hashPassword).not.toHaveBeenCalled()
      expect(consumePasswordResetToken).not.toHaveBeenCalled()
    })

    it('T-RS06: Expired token → 400 TOKEN_EXPIRED (distinct error code)', async () => {
      // SENIOR ARCHITECT NOTE: distinct error code (TOKEN_EXPIRED vs
      // TOKEN_INVALID) — UX surfaces "your link expired, request a
      // new one" instead of "this link doesn't look valid." Different
      // recovery paths from the user's perspective.
      //
      // INPUT ENTROPY SEMANTIC NOTE: distinguishing TOKEN_INVALID
      // from TOKEN_EXPIRED is INTENTIONALLY NOT anti-enumeration here.
      // Reset token is 32-byte random hex (256-bit entropy) → attacker
      // cannot enumerate via timing or response code; they'd have to
      // guess one valid token in 2^256 attempts (computationally
      // infeasible). Compare to forgot/verify-resend which query by
      // EMAIL (low entropy, dictionary-attackable) and MUST collapse
      // to generic-200 for anti-enumeration.
      //
      // The entropy of the input determines whether distinct error
      // codes are safe:
      //   - Low entropy input (email, username) → generic-200 collapse
      //     mandatory (forgot, verify-resend, login wrong-password
      //     401 unification)
      //   - High entropy input (random token) → distinct codes safe
      //     and UX-helpful (reset, verify)
      //
      // This is the architectural justification for reset's deliberate
      // departure from the anti-enumeration BENCHMARK established by
      // verify-resend (Phase 1.D.16) and forgot (Phase 1.D.17). See
      // those test files for the BENCHMARK pattern.
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce({
        ...validUser,
        passwordResetTokenExpiresAt: PAST_ISO, // expired 1h ago
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('TOKEN_EXPIRED')
      expect(body.message).toContain('süresi dolmuş')
      expect(recordFailure).toHaveBeenCalledOnce()
      expect(consumePasswordResetToken).not.toHaveBeenCalled()
    })

    it('T-RS07: expiresAt missing → 400 TOKEN_INVALID (data integrity edge)', async () => {
      // L108 gate. User found via token, but the user record has
      // passwordResetTokenExpiresAt=null. Data integrity edge — likely
      // a stale record from before the TTL field was added, or a race
      // where token was set but TTL didn't persist.
      //
      // DISTINCT GATE from T-RS05 (which is L100, !user) and T-RS06
      // (which is L116, expired). All three converge to 400 but via
      // different code paths. T-RS07 specifically covers the
      // missing-TTL data-integrity edge — fail-secure default treats
      // ambiguous TTL state as invalid.
      //
      // Same error code as T-RS05 (TOKEN_INVALID) to preserve the
      // entropy-based design (high-entropy input, distinct codes
      // for distinct UX paths — but missing-TTL doesn't have a
      // distinct UX recovery, so it bundles with INVALID).
      vi.mocked(findUserByPasswordResetToken).mockResolvedValueOnce({
        ...validUser,
        passwordResetTokenExpiresAt: null,
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('TOKEN_INVALID')
      expect(recordFailure).toHaveBeenCalledOnce()
      expect(consumePasswordResetToken).not.toHaveBeenCalled()
    })
  })

  // ─── Storage edge cases ────────────────────────────────────────────────────

  describe('storage edge cases', () => {
    it('T-RS08: consumePasswordResetToken returns null → 500 INTERNAL', async () => {
      // L130-136 gate. Token validated, password hashed, but the
      // atomic consume operation returned null (store-side write
      // failure: RLS reject, DB connection blip, race where user was
      // deleted between findUserByPasswordResetToken and
      // consumePasswordResetToken).
      //
      // 500 INTERNAL (not 400) because the failure is server-side, not
      // user-input. The user's token + password were both valid;
      // retry should succeed once the underlying issue clears.
      // deleteAllSessionsForUser is NOT called — no point invalidating
      // sessions for a password change that didn't actually persist.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(consumePasswordResetToken).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('INTERNAL')
      expect(body.ok).toBe(false)

      // consumePasswordResetToken was attempted
      expect(consumePasswordResetToken).toHaveBeenCalledOnce()

      // Session invalidation NOT triggered for failed write
      expect(deleteAllSessionsForUser).not.toHaveBeenCalled()
      // No audit log for non-event
      expect(writeAuditLog).not.toHaveBeenCalled()

      // console.error captured for operator forensics
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  // ─── Rate limiting (R-01, R-02) ────────────────────────────────────────────

  describe('rate limiting (R-01, R-02)', () => {
    it('T-RS09: 11th IP attempt → 429 with Retry-After (R-02 mechanism)', async () => {
      // SENIOR ARCHITECT NOTE: T-RS09 tests the R-02 rate-limit
      // mechanism (per-process limiter; multi-instance amplification
      // is the broader R-02 concern, not directly probed at unit
      // level). R-01 (IP rotation bypass) is parallel to T-LG11
      // (login) — attacker rotating x-forwarded-for can reset the
      // IP-keyed bucket. This route does NOT use email-keyed limit
      // (forgot does), so R-01 vector is fully open here: an attacker
      // with a valid-but-leaked reset token (from log line, screen
      // capture, etc.) can rotate IPs to bypass the 10/5min limit
      // entirely. Audit T-RS09's R-01+R-02 mapping flags this.
      //
      // COMPOUND RISK NOTE (Phase 1.5 audit revision candidate, NOT
      // an amendment yet): R-01 IP rotation + R-19 distributed logout
      // compound at reset's session-invalidation step. Multi-instance
      // deployment with rotated IPs allows attacker to:
      //   1. Exhaust reset-rate-limit budget on Instance A's per-process
      //      limiter, but rotate IP → land on Instance B with fresh
      //      bucket (R-01 + R-02 chain).
      //   2. Successfully reset password using one of N attempts.
      //   3. Session-invalidation (deleteAllSessionsForUser) only
      //      clears tokens on whichever instance handled the reset
      //      request. Other instances' revokedTokens Set is unchanged
      //      (R-19 distributed logout failure).
      //   4. Net result: attacker gets new password, but old
      //      attacker-known sessions remain valid on instances that
      //      didn't process the reset. Window of overlap until those
      //      sessions naturally expire.
      //
      // This compound is not currently in audit Section 2 as a
      // distinct R-NN. It would benefit from explicit documentation
      // in a future audit revision after Phase 1.5 hardening sprint
      // (cluster-aware revocation per R-19's hardening proposals
      // closes this; combined IP+email rate-limit per R-18's hardening
      // also helps). The compound is too complex to probe at unit
      // level — Phase 5 integration territory.
      const resetAt = Date.now() + 60_000
      vi.mocked(checkRateLimit).mockReturnValueOnce({
        limited: true,
        remaining: 0,
        resetAt,
      })

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body.error).toBe('RATE_LIMITED')

      const retryAfter = response.headers.get('retry-after')
      expect(retryAfter).toBeTruthy()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(60)

      // Short-circuit: nothing downstream runs
      expect(recordFailure).not.toHaveBeenCalled()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(findUserByPasswordResetToken).not.toHaveBeenCalled()
      expect(consumePasswordResetToken).not.toHaveBeenCalled()
    })
  })

  // ─── Scrypt DoS guard ──────────────────────────────────────────────────────

  describe('scrypt DoS guard', () => {
    it('T-RS11: Scrypt not invoked on weak-password path (DoS guard)', async () => {
      // SENIOR ARCHITECT NOTE: scrypt DoS guard regression test.
      // PRIMARY assertion: hashPassword.not.toHaveBeenCalled().
      //
      // Source comment L87-89 explicit:
      //   "Validate password format BEFORE hashing — scrypt is
      //   intentionally expensive and we don't want attackers
      //   triggering it on every junk-password attempt."
      //
      // Why this matters: scrypt is ~50ms on commodity hardware
      // (intentional, to make password cracking expensive). An
      // attacker who can trigger scrypt on every POST without
      // password validation gets a CPU-DoS multiplier — 1 attacker
      // request = 50ms server CPU. With 100 concurrent attackers,
      // that's 5 server-CPU-seconds per second of attack, saturating
      // worker threads.
      //
      // The validation order matters: source places isValidPassword
      // (L90) BEFORE findUserByPasswordResetToken (L99) and BEFORE
      // hashPassword (L128). A regression that reorders these — e.g.,
      // hashes first then validates length — would re-open the DoS
      // surface.
      //
      // T-RG06 cross-reference (Phase 1.D.11): same scrypt-avoidance
      // pattern in register, applied here for reset's password
      // validation step. T-LG06/T-LG07 (login) is the third instance
      // of the pattern (length-cap before authenticateUser).
      //
      // REJECTED ALTERNATIVE: collapse T-RS11 into T-RS04 (which
      // already includes hashPassword.not.toHaveBeenCalled()).
      // Rejected — response correctness vs DoS-guard mechanism are
      // different assertion intents (parallel to T-FG05 vs T-FG10
      // in forgot/route, where T-FG05 is response shape and T-FG10
      // is bucket-key argument). T-RS04's assertion suite is
      // primarily about user-facing error correctness; T-RS11 is
      // primarily a regression guard for the scrypt-DoS protection.
      // A future refactor that adds a length-only check in T-RS04's
      // assertion path but accidentally hashes BEFORE the order
      // change (e.g., normalize password → hash → validate) would
      // pass T-RS04 (still 400 WEAK_PASSWORD eventually) but break
      // T-RS11's DoS protection. Splitting catches that regression.
      const response = await POST(
        makePostRequest({ ...validBody, newPassword: '1234567' }),
      )

      expect(response.status).toBe(400)
      // PRIMARY: scrypt was NOT invoked despite the request reaching
      // the route handler. The password validation gate fired first.
      expect(hashPassword).not.toHaveBeenCalled()

      // Secondary: token DB lookup also short-circuited (validation
      // gate fires BEFORE DB query)
      expect(findUserByPasswordResetToken).not.toHaveBeenCalled()
      expect(consumePasswordResetToken).not.toHaveBeenCalled()
    })
  })
})
