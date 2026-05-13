// SENIOR ARCHITECT NOTE: forgot/route.ts is the SECOND instance of the anti-
// enumeration BENCHMARK pattern in this codebase (first: verify/resend/route.ts,
// Phase 1.D.16). Same security design template, different domain semantics.
// Mock matrix mirrors verify-resend exactly — only the specific store and
// email function names differ (setPasswordResetToken vs setEmailVerifyToken,
// sendPasswordResetEmail vs sendVerificationEmail).

vi.mock('@/lib/soc-store-adapter', () => ({
  readUserByEmailKey: vi.fn(),
  setPasswordResetToken: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { readUserByEmailKey, setPasswordResetToken, writeAuditLog } from '@/lib/soc-store-adapter'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { sendPasswordResetEmail } from '@/lib/email'
import { POST } from './route'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/auth/forgot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = { email: 'u@example.com' }

const validUser = {
  id: 1,
  email: 'u@example.com',
  emailKey: 'u@example.com',
  username: 'user1',
  displayName: 'User One',
  isActive: true,
  emailVerified: true, // forgot REQUIRES emailVerified=true (opposite of verify-resend)
}

const updatedUser = {
  id: 1,
  email: 'u@example.com',
  username: 'user1',
  displayName: 'User One',
}

const GENERIC_OK = 'Eğer bu email kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.'

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({
    limited: false,
    remaining: 2,
    resetAt: Date.now() + 60 * 60 * 1000,
  })
  vi.mocked(readUserByEmailKey).mockResolvedValue(validUser as never)
  vi.mocked(setPasswordResetToken).mockResolvedValue(updatedUser as never)
  vi.mocked(sendPasswordResetEmail).mockResolvedValue({ ok: true } as never)
})

describe('forgot/route POST', () => {
  // ─── Happy path (T-FG01) ───────────────────────────────────────────────────

  describe('happy path', () => {
    it('T-FG01: Known verified active email → 200, token persisted, email dispatched', async () => {
      // SENIOR ARCHITECT NOTE: success contract has THREE invariants:
      //   (1) Response is generic 200 (anti-enumeration — same shape as
      //       all other paths)
      //   (2) setPasswordResetToken called with user.id + token + ISO
      //       expiresAt (token persisted to store)
      //   (3) sendPasswordResetEmail called with reset URL (email
      //       dispatched)
      //
      // recordFailure is also called regardless of outcome (source L97)
      // to ensure abuse can't iterate through valid email lookups
      // without consuming rate-limit budget.
      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      expect(setPasswordResetToken).toHaveBeenCalledOnce()
      // setPasswordResetToken signature: (userId, token, expiresAt)
      const [userId, token, expiresAt] = vi.mocked(setPasswordResetToken).mock.calls[0]
      expect(userId).toBe(validUser.id)
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
      expect(typeof expiresAt).toBe('string') // ISO date

      expect(sendPasswordResetEmail).toHaveBeenCalledOnce()
      expect(recordFailure).toHaveBeenCalledOnce()
    })
  })

  // ─── Anti-enumeration response collapse (T-FG02, T-FG03, T-FG04) ──────────

  describe('anti-enumeration response collapse', () => {
    it('T-FG02: Unknown email → 200 generic', async () => {
      // SENIOR ARCHITECT NOTE: Codebase'de SECOND instance of anti-
      // enumeration BENCHMARK; first established by verify-resend
      // (Phase 1.D.16, T-VR02/T-VR03/T-VR07). T-FG02/T-FG03/T-FG04
      // mirror the same invariant-testing approach: distinct backend
      // gates collapse to identical user-observable response.
      //
      // T-FG02 specific path: readUserByEmailKey returns null (email
      // never registered). Same generic 200 as success path — attacker
      // probing /api/auth/forgot cannot enumerate registered email
      // addresses via response shape.
      //
      // Phase 1.5 A-14 hardening template: look at BOTH forgot/route
      // AND verify-resend/route as reference implementations of the
      // generic-200 collapse pattern. Login (A-14 source) currently
      // distinguishes 401 vs 403 EMAIL_NOT_VERIFIED; mirroring forgot/
      // verify-resend's pattern would close that enumeration vector.
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest({ email: 'unknown@example.com' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // No token write, no email — but identical response to T-FG01
      expect(setPasswordResetToken).not.toHaveBeenCalled()
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('T-FG03: Unverified email → 200 generic (OPPOSITE gate vs verify-resend)', async () => {
      // SENIOR ARCHITECT NOTE: this test surfaces the most subtle
      // semantic distinction between forgot and verify-resend — same
      // anti-enumeration pattern, OPPOSITE gate logic on emailVerified.
      //
      //   forgot (source L106):       !user || !isActive || !emailVerified
      //                                                     ^^^^^^^^^^^^^
      //                                                     UNVERIFIED blocks
      //   verify-resend (source L80): !user || !isActive ||  emailVerified
      //                                                     ^^^^^^^^^^^^
      //                                                     VERIFIED blocks
      //
      // Both correct, opposite domain semantics:
      //   - forgot: can't reset password for an account whose email
      //     wasn't verified — the email isn't proven to be theirs, so
      //     a reset link sent to that address could go to a third
      //     party who claimed it
      //   - verify-resend: no need to send a verification email to an
      //     already-verified account — would be spam + confusion
      //
      // Junior-dev gotcha: a refactor that "normalizes" the two routes'
      // user-skip conditions to a single shared helper might collapse
      // them to the same logic, breaking ONE of the two routes
      // depending on which direction the helper goes. This test guards
      // forgot's specific direction.
      //
      // Same anti-enumeration pattern as T-VR03 (verify-resend), opposite
      // gate trigger. Both produce identical generic-200 collapse.
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce({
        ...validUser,
        emailVerified: false,
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // Critical: unverified user must NOT have a reset token written.
      // Sending a reset link to an unverified email could ship a
      // password-reset capability to whoever ACTUALLY owns the address
      // (which may not be the registered user).
      expect(setPasswordResetToken).not.toHaveBeenCalled()
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('T-FG04: Disabled user (isActive:false) → 200 generic', async () => {
      // SENIOR ARCHITECT NOTE: parallel to T-VR07 (verify-resend
      // disabled-user case). Disabled accounts (administratively
      // soft-deleted, suspended, banned) should not get reset tokens
      // — a reset would let them re-establish access to a flagged
      // account.
      //
      // Generic 200 preserves the anti-enumeration property: an
      // attacker who knows a target was disabled cannot confirm that
      // state via this endpoint.
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce({
        ...validUser,
        isActive: false,
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      expect(setPasswordResetToken).not.toHaveBeenCalled()
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })

  // ─── Rate limiting (T-FG05, R-02 mechanism) ────────────────────────────────

  describe('rate limiting (R-02 mechanism)', () => {
    it('T-FG05: 4th attempt same email → 429 (rate-limit response shape)', async () => {
      // SENIOR ARCHITECT NOTE: T-FG05 probes the user-facing rate-limit
      // RESPONSE SHAPE — verifies the 429 + Retry-After contract is
      // honored. Paired with T-FG10 which probes the rate-limit's
      // INTERNAL KEY (emailKey vs IP).
      //
      // T-FG05 = mechanism check (response shape)
      // T-FG10 = vector identification (key argument)
      //
      // REJECTED ALTERNATIVE: collapse T-FG05 and T-FG10 into one
      // test. Rejected — a future refactor that swaps emailKey to
      // clientIp would still pass T-FG05's response-shape assertions
      // (429 + RATE_LIMITED body unchanged) but would break R-18's
      // vector identification (the rate-limit would no longer be
      // email-keyed, so the victim-lockout DoS would no longer apply).
      // Splitting the assertions catches the silent regression.
      const resetAt = Date.now() + 60 * 60 * 1000
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetAt,
      })

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body).toEqual({ ok: false, error: 'RATE_LIMITED' })

      const retryAfter = response.headers.get('retry-after')
      expect(retryAfter).toBeTruthy()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(60 * 60)

      // Short-circuit: nothing downstream runs
      expect(recordFailure).not.toHaveBeenCalled()
      expect(readUserByEmailKey).not.toHaveBeenCalled()
      expect(setPasswordResetToken).not.toHaveBeenCalled()
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('T-FG11: 429 emits rate_limit.exceeded audit log entry (R-06 FIXED in db48dfd)', async () => {
      // FIX EVIDENCE: Phase 1.5.11 R-06 — see login/route.test.ts T-LG13
      // for full rationale. Forgot bucket is emailKey-keyed
      // (FORGOT_RATE_LIMIT.bucket = 'auth.forgot'); key_preview hashes
      // the emailKey via SHA-256 (8-char prefix, not the full email).
      const resetAt = Date.now() + 60 * 60 * 1000
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetAt,
      })

      await POST(makePostRequest({ email: 'victim@example.com' }))

      expect(writeAuditLog).toHaveBeenCalled()
      const call = vi.mocked(writeAuditLog).mock.calls[0][0]
      expect(call.action).toBe('rate_limit.exceeded')
      expect(call.entityType).toBe('rate_limit')
      expect(call.entityId).toBe('auth.forgot')
      expect(call.actorUserId).toBeNull()
      expect(call.details?.bucket).toBe('auth.forgot')
      expect(call.details?.key_preview).toMatch(/^[0-9a-f]{8}$/)
      // Privacy: full email NEVER in details
      expect(JSON.stringify(call.details)).not.toContain('victim@example.com')
      expect(call.details?.remaining).toBe(0)
      expect(call.details?.resetAt).toBe(resetAt)
    })
  })

  // ─── Input validation (T-FG06) ─────────────────────────────────────────────

  describe('input validation', () => {
    it('T-FG06: Invalid email format → 400 INVALID_EMAIL (early reject before rate-limit)', async () => {
      // SENIOR ARCHITECT NOTE: source L78-81 — format check fires
      // BEFORE rate-limit check. Source comment L74-77: "Format check
      // first — invalid format = 400 before we waste limiter slots.
      // Same generic-error pattern as /verify/resend: a malformed
      // input is its own error class, not a 'this email doesn't
      // exist' signal."
      //
      // 400 INVALID_EMAIL is NOT an enumeration leak — it tells the
      // attacker only that their input couldn't parse as an email
      // (any client-side regex could determine this). Generic-200
      // collapse for valid-format cases preserves the existence
      // oracle's closure.
      const response = await POST(makePostRequest({ email: 'not-an-email' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toEqual({ ok: false, error: 'INVALID_EMAIL' })

      // Rate-limit not consulted; downstream not invoked
      expect(checkRateLimit).not.toHaveBeenCalled()
      expect(recordFailure).not.toHaveBeenCalled()
      expect(readUserByEmailKey).not.toHaveBeenCalled()
    })
  })

  // ─── Email failure (T-FG07, R-12) ──────────────────────────────────────────

  describe('email failure (R-12)', () => {
    it('T-FG07: Email send failure → 200 generic (R-12 swallow)', async () => {
      // SENIOR ARCHITECT NOTE: same R-12 pattern as T-VR06 (verify-
      // resend, Phase 1.D.16). sendPasswordResetEmail returns ok:false
      // → console.warn at source L125-127 → response shape unchanged
      // (still generic 200).
      //
      // User sees GENERIC_OK ("if email is registered, link sent")
      // and assumes the reset email is on its way — but it isn't.
      // UX silently broken: user "checks inbox," doesn't see email,
      // retries (consuming rate-limit budget), still fails. After 3
      // attempts, victim is locked out for an hour (R-18 chain) without
      // ever knowing the underlying issue is email dispatch.
      //
      // PHASE 1.5 HARDENING PROPOSAL (per T-VR06's analysis, identical
      // here since same R-12 pattern):
      //   (a) Retry queue: failed dispatches enqueued to background
      //       job with exponential backoff
      //   (b) Structured error metric: counter on each ok:false →
      //       operator dashboard + threshold-based alert
      //   (c) Admin alert threshold: per-account dispatch failure
      //       counter → flag for manual review after N consecutive
      //       failures
      //
      // REJECTED ALTERNATIVE: hard 503 to user on email failure.
      // Rejected for the SAME reason as T-VR06's REJECTED ALTERNATIVE
      // — that would reopen the enumeration vector via 503-vs-200
      // differential. If forgot returns 503 for "email exists,
      // dispatch failed" but 200 for "email exists, dispatched" or
      // "email doesn't exist," the 503 reveals "this email is in our
      // DB AND Resend has a quirk with it." Generic-200 collapse is
      // the anti-enumeration price; R-12's hardening must preserve it
      // (background retry + structured alerting, NOT user-facing
      // error code change). See T-VR06 REJECTED ALTERNATIVE for the
      // full reasoning chain.
      //
      // Reset is more sensitive than verify (1h TTL vs 24h, controls
      // password not just email-verified flag), so the silent-failure
      // UX gap matters more here. Phase 1.5 hardening priority:
      // forgot's R-12 fix should land before verify-resend's.
      vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce({
        ok: false,
        error: 'Resend 503',
      } as never)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(makePostRequest(validBody))

      // Generic 200 despite send failure — body shape unchanged
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // Token WAS written (regression guard against accidental rollback
      // on email failure — same eventual-delivery semantics as register
      // T-RG10 and verify-resend T-VR06)
      expect(setPasswordResetToken).toHaveBeenCalledOnce()

      // Send was attempted
      expect(sendPasswordResetEmail).toHaveBeenCalledOnce()

      // console.warn called from L126 (the swallow log)
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  // ─── Store edge cases (T-FG08, T-FG09) ─────────────────────────────────────

  describe('store edge cases', () => {
    it('T-FG08: setPasswordResetToken returns null → 200 generic, no email', async () => {
      // SENIOR ARCHITECT NOTE: source L113-116 gate. Token write
      // returned null (signals store-side write failure: RLS reject,
      // DB connection blip, race where user deleted between
      // readUserByEmailKey and setPasswordResetToken). The route
      // logs internally (console.warn) and returns generic 200 to
      // preserve anti-enumeration. Email dispatch is SKIPPED — sending
      // a reset link without a persisted token would create a "token
      // not in store" situation when the user clicks the link.
      //
      // Distinct from T-FG07 (sendPasswordResetEmail fails AFTER
      // token write succeeds): here the token wasn't written, so the
      // email path is short-circuited. T-FG07 has token + no email;
      // T-FG08 has neither.
      vi.mocked(setPasswordResetToken).mockResolvedValueOnce(null)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // Token write attempted but returned null
      expect(setPasswordResetToken).toHaveBeenCalledOnce()

      // Email NOT dispatched (no token to embed in link)
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()

      // console.warn captured the failure
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('T-FG09: Store throws → 200 generic (inner catch preserves anti-enumeration)', async () => {
      // SENIOR ARCHITECT NOTE: source L130-136 catch block. Any
      // unexpected error in the try block (readUserByEmailKey throws,
      // setPasswordResetToken throws, sendPasswordResetEmail throws
      // synchronously) is caught and converted to generic 200.
      //
      // Source comment L132-134: "Even on internal failure: generic
      // 200 to preserve the anti-enumeration property. The user can
      // re-submit; the next attempt will hit the rate limit if abuse
      // is in progress."
      //
      // This is a deliberate design tradeoff: hide internal errors
      // from the user (good for anti-enumeration, bad for
      // observability). Operator-side observability is via
      // console.error logs — Phase 1.5 hardening should add
      // structured alerting (same pattern as R-12) so ops sees the
      // signal.
      vi.mocked(readUserByEmailKey).mockRejectedValueOnce(new Error('store unreachable'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(makePostRequest(validBody))

      // Generic 200 despite the throw (catch block fired)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // No downstream side effects (catch fired before token write)
      expect(setPasswordResetToken).not.toHaveBeenCalled()
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()

      // console.error called from L131 (the catch log)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  // ─── R-18 victim lockout vector (T-FG10) ───────────────────────────────────

  describe('R-18 victim lockout vector', () => {
    it('T-FG10: Email-keyed limit lets attacker exhaust victim\'s reset budget (R-18 vector identification)', async () => {
      // SENIOR ARCHITECT NOTE: R-18 (Medium, A04) — LITERAL TARGET.
      // Audit Section 2 R-18 row specifies File(s)=forgot/route.ts;
      // verify-resend was added via A-15 amendment (Phase 1.D.16) but
      // forgot is the original documented site of this vector.
      //
      // T-FG10 vs T-FG05 — DIFFERENT ASSERTION INTENTS:
      //   T-FG05: rate-limit RESPONSE SHAPE (429, Retry-After,
      //           RATE_LIMITED body) — mechanism check
      //   T-FG10: rate-limit KEY ARGUMENT (emailKey, NOT clientIp) —
      //           vector identification
      //
      // Both tests use checkRateLimit → limited mock; T-FG05 asserts
      // on the user-facing 429 contract, T-FG10 asserts on what KEY
      // the bucket is keyed by. The key argument is what makes R-18
      // exploitable: an email-keyed bucket means the attacker can
      // exhaust victim's budget without needing victim's IP, and
      // CONVERSELY the victim's legitimate request hits the same
      // bucket because it's the same emailKey.
      //
      // This test verifies checkRateLimit was called with emailKey
      // ('u@example.com') as the FIRST argument and FORGOT_RATE_LIMIT
      // bucket name as the SECOND argument. A regression that swaps
      // emailKey to e.g. clientIp would silently break R-18's
      // exploitability while leaving T-FG05's response-shape
      // assertions intact — only T-FG10 catches that regression.
      //
      // CONCRETE ATTACK CHAIN (R-18, parallel to T-VR04 in verify-
      // resend):
      //   1. Attacker knows victim's email
      //   2. Attacker POSTs /api/auth/forgot with body
      //      { email: 'victim@example.com' } three times
      //   3. checkRateLimit(emailKey='victim@example.com', ...)
      //      returns limited:true on the 4th request
      //   4. Victim's legitimate forgot-password attempt now lands
      //      in the SAME bucket → 429 for ~1 hour
      //   5. Result: attacker has DoS'd victim's password recovery
      //
      // CROSS-REFERENCE T-VR04: same R-18 vector at verify-resend.
      // A-15 amendment broadens R-18's File(s) field to cover both.
      // Hardening proposal (combined IP+email rate-limit) applies to
      // both routes identically.
      //
      // REJECTED ALTERNATIVE: assert on response.status only (same as
      // T-FG05). Rejected — that doesn't probe R-18's vector. The
      // bucket-key argument inspection is the unique value of T-FG10.
      const response = await POST(makePostRequest(validBody))

      // Verify checkRateLimit was called with EMAIL KEY (not IP)
      expect(checkRateLimit).toHaveBeenCalledOnce()
      expect(checkRateLimit).toHaveBeenCalledWith(
        'u@example.com', // emailKey, NOT clientIp
        expect.objectContaining({
          bucket: 'auth.forgot',
          max: 3,
          windowMs: 60 * 60 * 1000,
        }),
      )

      // recordFailure ALSO called with emailKey (parallel pattern,
      // L97 — both rate-limit operations bucket-keyed by email)
      expect(recordFailure).toHaveBeenCalledOnce()
      expect(recordFailure).toHaveBeenCalledWith(
        'u@example.com',
        expect.objectContaining({ bucket: 'auth.forgot' }),
      )
    })
  })
})
