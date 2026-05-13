// SENIOR ARCHITECT NOTE: verify/resend/route.ts has 5 module dependencies with
// side effects (rate-limit state, store writes, email dispatch). Mock at module
// boundary. identity-validation is NOT mocked — pure function unit-tested in
// Phase 1.D.3, used real here for integration check (route's email format
// gate must integrate correctly with the validator).
// REJECTED ALTERNATIVE: mock validateEmail. Rejected — the route's flow
// (validate → rate-limit → lookup → token → email) IS the orchestration
// we want to verify; stubbing the first gate would skip the integration.

vi.mock('@/lib/soc-store-adapter', () => ({
  readUserByEmailKey: vi.fn(),
  setEmailVerifyToken: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { readUserByEmailKey, setEmailVerifyToken, writeAuditLog } from '@/lib/soc-store-adapter'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { sendVerificationEmail } from '@/lib/email'
import { POST } from './route'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/auth/verify/resend', {
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
  displayName: 'User One',
  isActive: true,
  emailVerified: false,
}

const updatedUser = {
  id: 1,
  email: 'u@example.com',
  displayName: 'User One',
}

const GENERIC_OK = 'Eger email kayitliysa, yeni dogrulama bagi gonderildi.'

beforeEach(() => {
  // Baseline: rate-limit ok, user found+unverified+active, store + email
  // dispatch both succeed.
  vi.mocked(checkRateLimit).mockResolvedValue({
    limited: false,
    remaining: 2,
    resetAt: Date.now() + 60 * 60 * 1000,
  })
  vi.mocked(readUserByEmailKey).mockResolvedValue(validUser as never)
  vi.mocked(setEmailVerifyToken).mockResolvedValue(updatedUser as never)
  vi.mocked(sendVerificationEmail).mockResolvedValue({ ok: true } as never)
})

describe('verify/resend/route POST', () => {
  // ─── Happy path (T-VR01) ───────────────────────────────────────────────────

  describe('happy path', () => {
    it('T-VR01: Valid unverified email → 200 generic + token set + email dispatched', async () => {
      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      expect(setEmailVerifyToken).toHaveBeenCalledOnce()
      expect(sendVerificationEmail).toHaveBeenCalledOnce()
      // recordFailure called regardless of success — abuse can't iterate
      // through the rate-limit budget by guessing valid emails.
      expect(recordFailure).toHaveBeenCalledOnce()
    })
  })

  // ─── Anti-enumeration response collapse (T-VR02, T-VR03, T-VR07) ──────────

  describe('anti-enumeration response collapse', () => {
    it('T-VR02: Unknown email → 200 generic (anti-enumeration)', async () => {
      // SENIOR ARCHITECT NOTE: this route is the anti-enumeration BENCHMARK
      // in the codebase. T-VR02, T-VR03, and T-VR07 all probe distinct
      // backend code paths that produce IDENTICAL response shape (200 +
      // GENERIC_OK message). Attacker cannot enumerate email existence,
      // verification status, or account-active status via this endpoint.
      //
      // Compare to login (A-14): login DOES enumerate (401 vs 403 for
      // unverified accounts) — different patterns for the same problem
      // class. Phase 1.5 hardening for A-14 (login enumeration) should
      // mirror this route's generic-200 collapse pattern as the
      // implementation template.
      //
      // PARALLEL TO T-SS02/T-SS03 (Phase 1.D.14 session route): same
      // invariant-testing approach — multiple distinct entry points
      // collapsed to identical response. Different domain (session read
      // vs resend trigger) but same defensive design idiom.
      //
      // T-VR02 specific path: readUserByEmailKey returns null (email
      // never registered). The route still returns generic OK because
      // distinguishing "email not found" from "email found, processing"
      // would let an attacker iterate through email lists to find
      // registered accounts.
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest({ email: 'unknown@example.com' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // No token write, no email dispatch — but identical response to
      // T-VR01's success path. The contract is "no observable difference."
      expect(setEmailVerifyToken).not.toHaveBeenCalled()
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('T-VR03: Already-verified email → 200 generic (no token write, no email)', async () => {
      // SENIOR ARCHITECT NOTE: anti-enumeration BENCHMARK. T-VR03's path:
      // user exists, isActive, but emailVerified=true. The route skips
      // token generation and email dispatch (sending a verification
      // email to an already-verified user would be spam + confusion).
      //
      // Critically, the response shape is IDENTICAL to T-VR01 (success)
      // and T-VR02 (unknown email). An attacker probing
      // /api/auth/verify/resend with a known email cannot determine
      // whether that email is verified — the verify-status oracle is
      // closed at this endpoint.
      //
      // Compare to login (A-14): login's 403 EMAIL_NOT_VERIFIED reveals
      // "this email exists AND is unverified" — a 2-bit oracle. Resend
      // collapses everything to 1-bit (200 generic) without revealing
      // which condition matched.
      //
      // Phase 1.5 A-14 hardening pattern: "make login behave like
      // resend." The same anti-enumeration collapse applied to login
      // would close A-14 entirely.
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce({
        ...validUser,
        emailVerified: true,
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // Verified user — no spam: token NOT regenerated, email NOT sent
      expect(setEmailVerifyToken).not.toHaveBeenCalled()
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('T-VR07: Disabled user (isActive:false) → 200 generic, no token write', async () => {
      // SENIOR ARCHITECT NOTE: third leg of the anti-enumeration trio.
      // T-VR07's path: user exists but isActive=false (administratively
      // disabled / soft-deleted account). The route does NOT regenerate
      // a verification token for disabled accounts — sending a fresh
      // verify link would let the disabled user (or attacker who learned
      // they own the email) re-verify and potentially regain access if
      // the disable was UI-level only.
      //
      // Anti-enumeration intent: an attacker who knows a target was
      // previously disabled should not be able to confirm that state via
      // this endpoint. Generic 200 for disabled accounts matches generic
      // 200 for unknown emails (T-VR02) and verified accounts (T-VR03).
      //
      // PARALLEL TO T-SS02/T-SS03: invariant testing across distinct
      // entry points. Three different backend conditions (unknown / verified
      // / disabled), one observable response. The route is the BENCHMARK
      // implementation of generic-200 collapse pattern.
      //
      // REGRESSION TARGET: a refactor that splits the L80 condition
      // (e.g. "if !user → 200, else if !isActive → 403, else if verified
      // → 200") would break the invariant. This test catches that.
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce({
        ...validUser,
        isActive: false,
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, message: GENERIC_OK })

      // Critical: disabled user must NOT have a fresh token written
      expect(setEmailVerifyToken).not.toHaveBeenCalled()
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })
  })

  // ─── Rate limiting (T-VR04, R-02 + R-18) ───────────────────────────────────

  describe('rate limiting (R-02, R-18)', () => {
    it('T-VR04: 4th attempt same email → 429 (R-18 victim lockout vector)', async () => {
      // SENIOR ARCHITECT NOTE: R-18 (Medium, A04) — email-keyed rate-
      // limit lockout. RESEND_RATE_LIMIT (source L15-19) keys the
      // bucket off emailKey with max=3 / windowMs=1h. Source comment
      // L60-62 explicitly: "Rate limit by emailKey (not IP) — per spec
      // '3 attempts per email per hour'. A real attacker could rotate
      // IPs but rotating emails is pointless (they'd have to control
      // each address)."
      //
      // CONCRETE ATTACK CHAIN:
      //   1. Attacker knows victim's email address (from breach dump,
      //      LinkedIn scrape, social engineering, etc.).
      //   2. Attacker POSTs /api/auth/verify/resend with body
      //      { email: 'victim@example.com' } three times in quick
      //      succession (under 1 hour).
      //   3. checkRateLimit(emailKey, RESEND_RATE_LIMIT) returns
      //      limited:true on the 4th request (regardless of which IP
      //      the attacker uses — bucket is keyed by email, not IP).
      //   4. Victim's legitimate /verify/resend request now also lands
      //      in the SAME bucket (same emailKey). Victim sees 429 for
      //      the next ~1 hour.
      //   5. Result: attacker has DoS'd victim's verification flow.
      //      Victim can't get a fresh verification email until the
      //      window resets.
      //
      // The vector is identical at /api/auth/forgot (R-18's literal
      // file per audit Section 2). Both routes use email-keyed rate
      // limit; both suffer the same victim-lockout DoS.
      //
      // CROSS-REFERENCE A-15: R-18's audit description says File(s)=
      // forgot/route.ts only, but T-VR04's mapping to R-18 implies
      // it also covers verify-resend. A-15 amendment broadens R-18's
      // scope to include verify/resend/route.ts.
      //
      // HARDENING PROPOSAL: combined (IP + email) rate limit. Track
      // BOTH dimensions; flag as suspicious if many distinct emails
      // hit from one IP (attacker bot) OR one email hit from many
      // IPs (DoS attempt). Honest legitimate user (one email, one IP,
      // <=3 retries) is not impacted; attacker (one email, one IP,
      // many requests) hit the email bucket; attacker (many emails,
      // one IP) hit the IP bucket. Both attack patterns blocked
      // without isolating victims.
      //
      // REJECTED ALTERNATIVE: drop email-keyed limit entirely, use only
      // IP-keyed. Rejected — IP rotation is trivial (residential proxies,
      // mobile networks); IP-only rate limit doesn't stop attackers and
      // creates a different victim-lockout (one ISP CGNAT user blocks
      // their entire network from resending).
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

      // Retry-After header derived from resetAt - now (in seconds)
      const retryAfter = response.headers.get('retry-after')
      expect(retryAfter).toBeTruthy()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(60 * 60)

      // T-VR08 below also exercises this 429 path to assert audit log.
      // Short-circuit: nothing downstream runs (no token write, no email
      // dispatch, no recordFailure — recordFailure is post-rate-limit).
      expect(recordFailure).not.toHaveBeenCalled()
      expect(readUserByEmailKey).not.toHaveBeenCalled()
      expect(setEmailVerifyToken).not.toHaveBeenCalled()
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('T-VR08: 429 emits rate_limit.exceeded audit log entry (R-06 FIXED in db48dfd)', async () => {
      // FIX EVIDENCE: Phase 1.5.11 R-06 — see login/route.test.ts T-LG13.
      // Verify-resend bucket is emailKey-keyed
      // (RESEND_RATE_LIMIT.bucket = 'auth.verify.resend').
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
      expect(call.entityId).toBe('auth.verify.resend')
      expect(call.details?.bucket).toBe('auth.verify.resend')
      expect(call.details?.key_preview).toMatch(/^[0-9a-f]{8}$/)
      // Privacy: full email NEVER in details
      expect(JSON.stringify(call.details)).not.toContain('victim@example.com')
      expect(call.details?.resetAt).toBe(resetAt)
    })
  })

  // ─── Input validation (T-VR05) ─────────────────────────────────────────────

  describe('input validation', () => {
    it('T-VR05: Invalid email format → 400 INVALID_EMAIL (early reject before rate-limit)', async () => {
      // SENIOR ARCHITECT NOTE: source L51-53 places format check BEFORE
      // rate-limit check. Comment in source: "Format check first —
      // invalid format = 400 before we waste limiter slots. Generic
      // message preserves the no-enumeration property: a malformed
      // input is its own class of error, not 'this email doesn't exist'."
      //
      // 400 INVALID_EMAIL is NOT an enumeration leak — it tells the
      // attacker only that their input couldn't parse as an email,
      // which any client-side regex could determine. The interesting
      // signal (does this email exist in our DB?) is still hidden
      // behind the generic-200 collapse for valid-format cases.
      //
      // REJECTED ALTERNATIVE: rate-limit FIRST, then format check.
      // Rejected — that wastes limiter slots on garbage input. An
      // attacker submitting random strings would burn through the
      // bucket without learning anything useful, but in doing so
      // would prevent legitimate users from resending. Format-first
      // ordering preserves bucket integrity.
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

  // ─── Email failure (T-VR06, R-12) ──────────────────────────────────────────

  describe('email failure (R-12)', () => {
    it('T-VR06: Email send failure → 200 generic (R-12 swallow)', async () => {
      // SENIOR ARCHITECT NOTE: R-12 (Low, A08) — email dispatch failures
      // swallowed; no retry queue. Source L104-106:
      //   if (!sendResult.ok) {
      //     console.warn('[auth/verify/resend] sendEmail failed:', ...)
      //   }
      //   return NextResponse.json({ ok: true, message: GENERIC_OK })
      //
      // The user sees GENERIC_OK ("if email is registered, link sent")
      // and assumes the email is on its way. But it isn't — Resend
      // returned an error (5xx, network blip, rate limit on Resend's
      // side). UX is silently broken: user "checks inbox," doesn't see
      // the email, retries (consuming another rate-limit slot), still
      // fails. After 3 attempts, victim is locked out for an hour
      // (R-18 chain) without ever knowing the underlying issue is
      // email dispatch, not their account state.
      //
      // PHASE 1.5 HARDENING PROPOSAL:
      //   (a) Retry queue: failed dispatches enqueued to a background
      //       job that retries with exponential backoff. After N
      //       failures, alerting kicks in.
      //   (b) Structured error metric: counter incremented on each
      //       sendResult.ok===false. Operator dashboard surfaces
      //       email-dispatch error rate; threshold-based alert
      //       (e.g., >5% failure rate over 1h) fires PagerDuty/Slack.
      //   (c) Admin alert threshold: per-account dispatch failure
      //       counter; if same emailKey fails N times consecutively,
      //       mark account as flagged for manual review (likely the
      //       email address is permanently undeliverable and should
      //       prompt user-side fix via support flow).
      //
      // REJECTED ALTERNATIVE: hard 503 to user on email failure.
      // Rejected — that would re-open an enumeration vector. If the
      // route returns 503 for "email exists, dispatch failed" but 200
      // for "email exists, dispatched" or "email doesn't exist," then
      // by induction the 503 reveals "this email is in our DB AND
      // Resend has a quirk with it." Generic-200 collapse is the
      // anti-enumeration price; R-12's hardening must preserve it
      // (background retry + structured alerting, NOT user-facing
      // error code change).
      vi.mocked(sendVerificationEmail).mockResolvedValueOnce({
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
      // T-RG10 from Phase 1.D.11)
      expect(setEmailVerifyToken).toHaveBeenCalledOnce()

      // Send was attempted
      expect(sendVerificationEmail).toHaveBeenCalledOnce()

      // console.warn called from L105 (the swallow log) — only operational
      // signal of the failure
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })
})
