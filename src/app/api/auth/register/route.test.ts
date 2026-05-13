import { NextRequest } from 'next/server'

// SENIOR ARCHITECT NOTE: register/route.ts has 6 external module dependencies
// with side effects (DB writes, network calls, scrypt CPU, rate-limit state).
// We mock them all at the module boundary so each test exercises the route's
// orchestration logic deterministically. identity-validation and identity-rules
// are NOT mocked — they are pure functions, already unit-tested in Phase 1.D.3
// and 1.D.4. Using them real here gives us a free integration check: if a
// future refactor breaks the validators, these route tests catch it too.
// REJECTED ALTERNATIVE: mock validators as well. Rejected — the route's
// validation chain (length checks, format checks, reserved checks) IS the
// orchestration we want to verify. Stubbing validators would leave the route's
// ordering and short-circuit logic unverified.

vi.mock('@/lib/soc-store-adapter', () => ({
  readUserByEmailKey: vi.fn(),
  registerUser: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/security', () => ({
  hashPassword: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn(),
}))
vi.mock('@/lib/client-ip', () => ({
  getClientIp: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))

import { readUserByEmailKey, registerUser, writeAuditLog } from '@/lib/soc-store-adapter'
import { hashPassword } from '@/lib/security'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { sendVerificationEmail } from '@/lib/email'
import { getClientIp } from '@/lib/client-ip'
import { getRequestMetadata } from '@/lib/auth-server'
import { POST } from './route'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  username: 'newuser',
  displayName: 'New User',
  email: 'new@example.com',
  password: 'password123',
  confirmPassword: 'password123',
}

beforeEach(() => {
  // Baseline mocks — happy-path defaults. Per-test overrides via
  // mockReturnValueOnce / mockResolvedValueOnce / mockRejectedValueOnce.
  vi.mocked(getClientIp).mockReturnValue('127.0.0.1')
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(checkRateLimit).mockResolvedValue({
    limited: false,
    remaining: 9,
    resetAt: Date.now() + 5 * 60 * 1000,
  })
  vi.mocked(hashPassword).mockReturnValue('mocked-hash:value')
  vi.mocked(readUserByEmailKey).mockResolvedValue(null)
  vi.mocked(registerUser).mockResolvedValue({
    id: 1,
    username: 'newuser',
    displayName: 'New User',
    role: 'viewer',
    emailVerified: false,
  } as never)
  vi.mocked(sendVerificationEmail).mockResolvedValue({ ok: true } as never)
})

describe('register/route POST', () => {
  // ─── T-RG01: happy path ─────────────────────────────────────────────────────

  describe('happy path', () => {
    it('T-RG01: All valid fields → 200, no warning', async () => {
      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.message).toBeTruthy()
      expect(body.warning).toBeUndefined()

      // Verify dispatch chain executed in order:
      expect(checkRateLimit).toHaveBeenCalledOnce()
      expect(recordFailure).toHaveBeenCalledOnce()
      expect(readUserByEmailKey).toHaveBeenCalledOnce()
      expect(hashPassword).toHaveBeenCalledOnce()
      expect(registerUser).toHaveBeenCalledOnce()
      expect(sendVerificationEmail).toHaveBeenCalledOnce()
    })
  })

  // ─── Field validation (early-reject before scrypt) ──────────────────────────

  describe('field validation (early-reject before scrypt)', () => {
    it('T-RG02: Missing field → 400 "Tum kayit alanlari zorunlu."', async () => {
      const response = await POST(makePostRequest({ ...validBody, username: '' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toEqual({ error: 'Tum kayit alanlari zorunlu.' })
      expect(hashPassword).not.toHaveBeenCalled()
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('T-RG05: Invalid username format (2 chars) → 400', async () => {
      // Real isAllowedUsername (USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/) rejects 2-char.
      const response = await POST(makePostRequest({ ...validBody, username: 'ab' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeTruthy()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('T-RG06: Weak password (7 chars) → 400 BEFORE scrypt is invoked', async () => {
      // SENIOR ARCHITECT NOTE: scrypt-avoidance regression guard. Source order
      // (route.ts L86-111) places format/length validations BEFORE password
      // hashing (L130). A regression that reorders the chain — e.g. moves
      // hashPassword before isValidPassword — would burn ~50ms scrypt CPU on
      // every malformed-password POST, opening a CPU-DoS vector. Asserting
      // hashPassword.not.toHaveBeenCalled() catches that ordering bug.
      // REJECTED ALTERNATIVE: only assert response.status===400. Rejected —
      // status 400 alone passes even if scrypt was wastefully called first.
      // The behavioral guarantee is "rejection AND scrypt avoided," both
      // need explicit assertion.
      const response = await POST(
        makePostRequest({ ...validBody, password: '1234567', confirmPassword: '1234567' }),
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeTruthy()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('T-RG07: Password mismatch → 400 "Sifreler birbiriyle eslesmiyor."', async () => {
      const response = await POST(
        makePostRequest({ ...validBody, confirmPassword: 'different-value' }),
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toEqual({ error: 'Sifreler birbiriyle eslesmiyor.' })
      expect(hashPassword).not.toHaveBeenCalled()
      expect(registerUser).not.toHaveBeenCalled()
    })

    it('T-RG08: Invalid email format → 400', async () => {
      const response = await POST(makePostRequest({ ...validBody, email: 'not-an-email' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeTruthy()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(registerUser).not.toHaveBeenCalled()
    })
  })

  // ─── Username rules (reserved list) ─────────────────────────────────────────

  describe('username rules', () => {
    it('T-RG04: Reserved username "ghost" → 400 with reserved error message', async () => {
      // Real isReservedUsername returns true for 'ghost' (verified in Phase 1.D.4
      // identity-rules.test.ts T-IR01). This test confirms the route integrates
      // the check correctly — when the validator says reserved, the route emits 400.
      // R-09 gap (admin/root/support NOT in reserved list) is documented in
      // T-IR04/05/06; not duplicated here.
      const response = await POST(makePostRequest({ ...validBody, username: 'ghost' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeTruthy()
      expect(registerUser).not.toHaveBeenCalled()
    })
  })

  // ─── Email uniqueness ───────────────────────────────────────────────────────

  describe('email uniqueness', () => {
    it('T-RG03: Duplicate active email → 409 "Bu email adresi zaten kullaniliyor."', async () => {
      vi.mocked(readUserByEmailKey).mockResolvedValueOnce({ isActive: true } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body).toEqual({ error: 'Bu email adresi zaten kullaniliyor.' })
      expect(registerUser).not.toHaveBeenCalled()
    })
  })

  // ─── Rate limiting (T-RG09, R-01 + R-02) ────────────────────────────────────

  describe('rate limiting (R-01/R-02)', () => {
    it('T-RG09: 11th POST same IP → 429 with Retry-After + recordFailure NOT called', async () => {
      // SENIOR ARCHITECT NOTE: rate-limit short-circuit at L58-69 must:
      //  (1) emit 429 with Turkish error message
      //  (2) include Retry-After header derived from resetAt - now (in seconds)
      //  (3) NOT invoke recordFailure (it would double-count a request that
      //      already crossed the limit)
      //  (4) NOT invoke any storage/email/scrypt operations
      //
      // R-01 (Vercel multi-instance amplification) and R-02 (per-process
      // limiter) are documented in audit Section 2; T-RG09 is the integration
      // probe that verifies the route honors the rate-limit gate.
      //
      // REJECTED ALTERNATIVE: assert checkRateLimit was called. Rejected —
      // that's a tautology (we mocked it). The interesting properties are
      // the response shape, the header presence, and the absence of
      // downstream side effects.
      const resetAt = Date.now() + 60_000
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetAt,
      })

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(429)
      const retryAfter = response.headers.get('retry-after')
      expect(retryAfter).toBeTruthy()
      expect(Number(retryAfter)).toBeGreaterThan(0)
      expect(Number(retryAfter)).toBeLessThanOrEqual(60)

      const body = await response.json()
      expect(body).toEqual({ error: 'Cok fazla kayit denemesi. Lutfen 5 dakika bekleyin.' })

      expect(recordFailure).not.toHaveBeenCalled()
      expect(readUserByEmailKey).not.toHaveBeenCalled()
      expect(hashPassword).not.toHaveBeenCalled()
      expect(registerUser).not.toHaveBeenCalled()
      expect(sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('T-RG14: 429 emits rate_limit.exceeded audit log entry (R-06 FIXED in db48dfd)', async () => {
      // FIX EVIDENCE: Phase 1.5.11 R-06 — see login/route.test.ts T-LG13
      // for full rationale. Register bucket is IP-keyed
      // (REGISTER_RATE_LIMIT.bucket = 'auth.register'); key_preview hashes
      // the client IP via SHA-256 (8-char prefix).
      const resetAt = Date.now() + 60_000
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetAt,
      })

      await POST(makePostRequest(validBody))

      expect(writeAuditLog).toHaveBeenCalled()
      const call = vi.mocked(writeAuditLog).mock.calls[0][0]
      expect(call.action).toBe('rate_limit.exceeded')
      expect(call.entityType).toBe('rate_limit')
      expect(call.entityId).toBe('auth.register')
      expect(call.actorUserId).toBeNull()
      expect(call.details?.bucket).toBe('auth.register')
      expect(call.details?.key_preview).toMatch(/^[0-9a-f]{8}$/)
      expect(call.details?.remaining).toBe(0)
      expect(call.details?.resetAt).toBe(resetAt)
    })
  })

  // ─── Email send failures ────────────────────────────────────────────────────

  describe('email send failures', () => {
    it('T-RG10: Email send failure → 200 with warning field (graceful degradation)', async () => {
      // SENIOR ARCHITECT NOTE: register prefers eventual-delivery semantics
      // over transactional-rollback. If the verification email fails to
      // send (Resend 5xx, network error, rate-limit), the route does NOT
      // roll back the registered user — it returns 200 with a `warning`
      // field so the client can prompt the user to use /verify/resend.
      // The user account exists, just unverified; they can recover via
      // the resend endpoint.
      //
      // This is intentional: rolling back on email failure would create a
      // race window where two register attempts could both fail email,
      // both roll back, and both retry — leading to confusion. Accept-and-
      // warn is the cleaner contract.
      vi.mocked(sendVerificationEmail).mockResolvedValueOnce({
        ok: false,
        error: 'Resend 503',
      } as never)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.warning).toBeTruthy()
      expect(body.warning).toContain('Verification email could not be sent')
      // User WAS created despite email failure (regression guard against
      // accidental rollback).
      expect(registerUser).toHaveBeenCalledOnce()
    })
  })

  // ─── Store error message-matching (T-RG11/12/13) ────────────────────────────

  describe('store error message matching', () => {
    it('T-RG11: Store throws "User already exists" → 409 username-taken message', async () => {
      // SENIOR ARCHITECT NOTE: the route catches storage errors and matches
      // by Error.message string equality (route.ts L177-186). This is a
      // STRING CONTRACT between register/route.ts and the 3 store backends
      // (memory, supabase, postgres). If any backend changes the message
      // (e.g. 'username taken' instead of 'User already exists'), the
      // route's match fails and the 503 fallback fires instead of 409 —
      // breaking the user-facing 'kullanici adi zaten kullaniliyor' message.
      // REJECTED ALTERNATIVE: structured error objects (e.g. error codes).
      // That would be the right hardening, but until it lands the string
      // contract IS the contract, and this test guards it.
      vi.mocked(registerUser).mockRejectedValueOnce(new Error('User already exists'))

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body).toEqual({ error: 'Bu kullanici adi zaten kullaniliyor.' })
    })

    it('T-RG12: Store throws "Email already exists" → 409 email-taken message', async () => {
      // SENIOR ARCHITECT NOTE: this is the indirect R-05 TOCTOU regression
      // guard (see pending amendments A-13). The pre-check at L116-119
      // catches MOST duplicate-email cases by reading first. But two
      // concurrent registers with the same email can both pass the
      // pre-check (race window between readUserByEmailKey and registerUser).
      // The storage layer's race-guard then throws 'Email already exists'
      // for the second call. This test verifies the route surfaces that
      // race-resolution to the user as a clean 409, not a 503.
      //
      // R-05 direct test (concurrent execution probe via Promise.all on
      // two register calls) belongs in storage-layer test suite (Phase 2
      // territory) — out of this turn's scope per audit row.
      vi.mocked(registerUser).mockRejectedValueOnce(new Error('Email already exists'))

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body).toEqual({ error: 'Bu email adresi zaten kullaniliyor.' })
    })

    it('T-RG13: Store throws unexpected error → 503 service-unavailable', async () => {
      // Default catch (route.ts L188-189) for any storage error whose
      // message does NOT match one of the three known strings. Maps to
      // a generic 503 to avoid leaking implementation details. console.error
      // logs the underlying error for operator forensics.
      vi.mocked(registerUser).mockRejectedValueOnce(new Error('Database connection lost'))

      // Suppress the console.error noise — the route logs unexpected
      // errors via console.error (route.ts L188), and we don't want the
      // test output polluted.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body).toEqual({ error: 'Kayit servisi su anda kullanilamiyor.' })
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })
})
