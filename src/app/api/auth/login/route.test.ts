// SENIOR ARCHITECT NOTE: login/route.ts has 4 external dependencies. We mock
// them all at the module boundary (vi.mock, hoisted). identity-validation is
// NOT imported by login (no format validators called — login only does
// length-cap checks at L51-53). security is NOT imported either (scrypt now
// lives inside authenticateUser at the store layer, opaque to the route).
// Mock listemde dolayısıyla 4 modül var (soc-store-adapter, rate-limiter,
// client-ip, auth-server), register'ın 6'sından az.

vi.mock('@/lib/soc-store-adapter', () => ({
  authenticateUser: vi.fn(),
  createSession: vi.fn(),
  readUserByUsername: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  clearAttempts: vi.fn(),
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
  authenticateUser,
  createSession,
  readUserByUsername,
  writeAuditLog,
} from '@/lib/soc-store-adapter'
import { checkRateLimit, clearAttempts, recordFailure } from '@/lib/rate-limiter'
import { getClientIp } from '@/lib/client-ip'
import { getRequestMetadata } from '@/lib/auth-server'
import { POST } from './route'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Helper to extract Set-Cookie header value across runtime variations.
// Node 22 (vitest) has Headers.getSetCookie(); fallback to headers.get for
// older runtimes.
function getSetCookieHeader(response: Response): string {
  const getter = (response.headers as Headers & {
    getSetCookie?: () => string[]
  }).getSetCookie
  if (typeof getter === 'function') {
    const arr = getter.call(response.headers)
    if (Array.isArray(arr) && arr.length > 0) return arr[0]
  }
  return response.headers.get('set-cookie') ?? ''
}

const validBody = {
  username: 'testuser',
  password: 'password123',
  remember: true,
}

const verifiedUser = {
  id: 1,
  username: 'testuser',
  displayName: 'Test User',
  role: 'viewer' as const,
  emailVerified: true,
}

const unverifiedUser = {
  id: 2,
  username: 'unverified',
  displayName: 'Unverified User',
  role: 'viewer' as const,
  emailVerified: false,
}

const mockSession = {
  token: 'session-token-abc123',
  user: verifiedUser,
  expiresAt: '2099-01-01T00:00:00Z',
}

beforeEach(() => {
  // Baseline: happy-path defaults. Per-test overrides via mockReturnValueOnce
  // / mockResolvedValueOnce / mockRejectedValueOnce.
  vi.mocked(getClientIp).mockReturnValue('127.0.0.1')
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(checkRateLimit).mockReturnValue({
    limited: false,
    remaining: 9,
    resetAt: Date.now() + 5 * 60 * 1000,
  })
  vi.mocked(authenticateUser).mockResolvedValue(verifiedUser as never)
  vi.mocked(createSession).mockResolvedValue(mockSession as never)
  vi.mocked(readUserByUsername).mockResolvedValue(null)
  vi.mocked(writeAuditLog).mockResolvedValue(undefined as never)
})

afterEach(() => {
  // T-LG09 stubs NODE_ENV='production'; restore between tests.
  vi.unstubAllEnvs()
})

describe('login/route POST', () => {
  // ─── Happy path + session creation ─────────────────────────────────────────

  describe('happy path + session creation', () => {
    it('T-LG01: Correct creds → 200, cookie set, audit logged', async () => {
      // SENIOR ARCHITECT NOTE: success contract has THREE invariants, all
      // asserted explicitly:
      //   (1) Response shape: { authenticated: true, user, expiresAt }
      //   (2) Set-Cookie header present with the session token + correct
      //       attributes (HttpOnly, SameSite=lax, Max-Age for remember=true)
      //   (3) Audit log written with action='auth.login' + correct user id
      // Any of these breaking means the login UX is broken (no UX without
      // cookie), forensic record is broken (no audit), or downstream
      // consumers parse incorrectly (no `authenticated` field). Asserting
      // all three guards the full contract.
      const response = await POST(makePostRequest(validBody))

      // (1) Body shape
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.authenticated).toBe(true)
      expect(body.user).toBeDefined()
      expect(body.expiresAt).toBe(mockSession.expiresAt)

      // (2) Set-Cookie header — soc_session=token + standard attributes
      const setCookie = getSetCookieHeader(response)
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('soc_session=session-token-abc123')
      expect(setCookie).toMatch(/HttpOnly/i)
      expect(setCookie).toMatch(/SameSite=lax/i)
      // remember=true (default) → Max-Age present (~30 days)
      expect(setCookie.toLowerCase()).toContain('max-age')

      // (3) Audit log
      expect(writeAuditLog).toHaveBeenCalledOnce()
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: verifiedUser.id,
          action: 'auth.login',
          entityType: 'session',
          entityId: mockSession.token,
        }),
      )
    })

    it('T-LG05: Successful login clears rate-limit counter', async () => {
      // SENIOR ARCHITECT NOTE: clearAttempts on success is a UX-protective
      // invariant. Without it, a user who just successfully logged in would
      // still have any previous failed-attempt counter against them — a
      // single typo from yesterday could chip away at today's budget.
      // Explicit (ip, bucket) arg check catches a regression that swaps
      // args silently (e.g. clearAttempts(bucket, ip) reversed).
      await POST(makePostRequest(validBody))

      expect(clearAttempts).toHaveBeenCalledWith('127.0.0.1', 'auth.login')
    })

    it('T-LG08: remember=false → cookie has no Max-Age (session-only)', async () => {
      // SENIOR ARCHITECT NOTE: cookie Max-Age contract.
      //   - remember=true (default): Max-Age=2592000 (30 days)
      //   - remember=false: NO Max-Age attribute → browser session cookie
      //     (cleared when browser closes)
      // User-facing privacy: "remember me" off should mean exactly that.
      // A regression that always sets Max-Age would silently break the
      // unchecked-remember-me UX.
      const response = await POST(makePostRequest({ ...validBody, remember: false }))

      expect(response.status).toBe(200)
      const setCookie = getSetCookieHeader(response)
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('soc_session=')
      // No Max-Age in cookie string — browser treats as session cookie
      expect(setCookie.toLowerCase()).not.toContain('max-age')
    })
  })

  // ─── Credentials validation ────────────────────────────────────────────────

  describe('credentials validation', () => {
    it('T-LG02: Wrong password → 401, recordFailure called', async () => {
      vi.mocked(authenticateUser).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body).toEqual({ error: 'Hatali kullanici adi veya sifre.' })

      expect(recordFailure).toHaveBeenCalledOnce()
      expect(recordFailure).toHaveBeenCalledWith(
        '127.0.0.1',
        expect.objectContaining({ bucket: 'auth.login' }),
      )

      // No session minted on wrong creds
      expect(createSession).not.toHaveBeenCalled()
      expect(writeAuditLog).not.toHaveBeenCalled()
    })

    it('T-LG10: Missing username/password → 400 "Kullanici adi ve sifre gerekli."', async () => {
      const response = await POST(makePostRequest({ password: 'pass' }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toEqual({ error: 'Kullanici adi ve sifre gerekli.' })
      // Early reject — authenticateUser MUST NOT be called for missing fields
      expect(authenticateUser).not.toHaveBeenCalled()
    })
  })

  // ─── Email verification gate ───────────────────────────────────────────────

  describe('email verification gate', () => {
    it('T-LG03: Correct creds, emailVerified=false → 403 EMAIL_NOT_VERIFIED, clearAttempts called', async () => {
      // SENIOR ARCHITECT NOTE: design rationale — "unverified ≠ punishment".
      // A user who knows the correct password but hasn't clicked the email
      // verification link should NOT have failed-attempt counter held
      // against them. Source L62-65 explicitly: "Brute-force protection is
      // about wrong-password volume; the right-password-but-unverified
      // path shouldn't be punished by a stale rate-limit window."
      //
      // clearAttempts (L66) fires AFTER authenticateUser succeeds (correct
      // password verified) but BEFORE the emailVerified gate (L83-97). This
      // ordering gives the unverified user a clean rate-limit slate while
      // still enforcing the email-gate.
      //
      // ASSERTIONS:
      //   (1) clearAttempts CALLED with explicit args ('127.0.0.1',
      //       'auth.login') — not just toHaveBeenCalled(); the (ip, bucket)
      //       signature is the contract. A regression swapping args would
      //       silently mis-clear another bucket's counter.
      //   (2) Response is 403 with EMAIL_NOT_VERIFIED + email field
      //       (best-effort lookup via readUserByUsername; supabase store
      //       returns email, memory/postgres return null per source L86-88).
      //   (3) createSession + writeAuditLog NOT called (no session minted
      //       for unverified accounts).
      //
      // Enumeration tradeoff (see pending amendments A-14): the 403 distinct
      // from 401 reveals username exists for unverified accounts. Documented
      // as intentional UX tradeoff in source L76-82. Phase 1.5 hardening
      // proposal: generic 401 + invisible-resend path.
      vi.mocked(authenticateUser).mockResolvedValueOnce(unverifiedUser as never)
      vi.mocked(readUserByUsername).mockResolvedValueOnce({
        ...unverifiedUser,
        email: 'unverified@example.com',
      } as never)

      const response = await POST(makePostRequest({ ...validBody, username: 'unverified' }))

      // (1) clearAttempts CALLED with correct args (BEFORE 403 emitted)
      expect(clearAttempts).toHaveBeenCalledWith('127.0.0.1', 'auth.login')

      // (2) Response shape
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('EMAIL_NOT_VERIFIED')
      expect(body.message).toBeTruthy()
      expect(body.email).toBe('unverified@example.com')

      // (3) No session minted, no audit log
      expect(createSession).not.toHaveBeenCalled()
      expect(writeAuditLog).not.toHaveBeenCalled()
    })
  })

  // ─── Length caps (early-reject before authenticateUser) ────────────────────

  describe('length caps (early-reject before authenticateUser)', () => {
    it('T-LG06: Username > 64 → 400 BEFORE authenticateUser (scrypt avoidance)', async () => {
      // SENIOR ARCHITECT NOTE: scrypt-avoidance via length cap. Source L51-53
      // checks lengths AFTER missing-field and BEFORE authenticateUser. A
      // regression that moves the length check after authenticateUser would
      // burn ~50ms scrypt CPU on every oversized-username probe, opening a
      // CPU-DoS vector. authenticateUser.not.toHaveBeenCalled() catches
      // that ordering bug.
      const response = await POST(makePostRequest({
        ...validBody,
        username: 'a'.repeat(65),
      }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toEqual({ error: 'Gecersiz kullanici adi veya sifre.' })
      expect(authenticateUser).not.toHaveBeenCalled()
    })

    it('T-LG07: Password > 256 → 400 BEFORE authenticateUser (scrypt avoidance)', async () => {
      const response = await POST(makePostRequest({
        ...validBody,
        password: 'a'.repeat(257),
      }))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body).toEqual({ error: 'Gecersiz kullanici adi veya sifre.' })
      expect(authenticateUser).not.toHaveBeenCalled()
    })
  })

  // ─── Rate limiting (R-01/R-02) ─────────────────────────────────────────────

  describe('rate limiting (R-01/R-02)', () => {
    it('T-LG04: 11th failed attempt → 429 with Retry-After header', async () => {
      const resetAt = Date.now() + 60_000
      vi.mocked(checkRateLimit).mockReturnValueOnce({
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
      expect(body).toEqual({ error: 'Cok fazla basarisiz deneme. Lutfen 5 dakika bekleyin.' })

      // Short-circuit: nothing downstream runs
      expect(authenticateUser).not.toHaveBeenCalled()
      expect(createSession).not.toHaveBeenCalled()
    })

    it('T-LG11: x-forwarded-for spoof bypasses rate limit (R-01 integration)', async () => {
      // SENIOR ARCHITECT NOTE: R-01 (High, A07) integration probe. The
      // attack: rotate x-forwarded-for header per request → getClientIp
      // returns different IPs → rate-limiter's bucket is per-IP → each
      // request hits a fresh count → unlimited brute-force from a single
      // attacker source.
      //
      // Route-level test: simulate IP rotation by mocking getClientIp to
      // return a different IP per call. Verify the rate-limiter is called
      // with N distinct IP keys (each request gets independent counter),
      // so 11 failed attempts NEVER trigger 429.
      //
      // The actual spoofing capability (whether attacker can set
      // x-forwarded-for) lives in client-ip.ts (Phase 1.D.5 T-CI04
      // documents the trustProxy gap). This test is the ROUTE-LEVEL
      // integration confirmation that the spoofing bypass works
      // end-to-end through the login flow.
      //
      // REJECTED ALTERNATIVE: assert checkRateLimit returns false 11 times.
      // Rejected — that's a tautology since we mock it. The interesting
      // property is "11 distinct IPs → 11 independent buckets," which we
      // verify via call-args inspection (Set size === 11).
      let callCount = 0
      vi.mocked(getClientIp).mockImplementation(() => `1.2.3.${++callCount}`)
      vi.mocked(authenticateUser).mockResolvedValue(null) // all attempts fail

      for (let i = 0; i < 11; i++) {
        const response = await POST(makePostRequest(validBody))
        expect(response.status).toBe(401) // failed auth, NOT 429
      }

      expect(checkRateLimit).toHaveBeenCalledTimes(11)
      const ipsCalled = vi.mocked(checkRateLimit).mock.calls.map((c) => c[0])
      expect(new Set(ipsCalled).size).toBe(11) // 11 distinct IPs, no rate-limit
    })
  })

  // ─── Error handling (T-LG09) ───────────────────────────────────────────────

  describe('error handling', () => {
    it('T-LG09: Store throws → 503 with no debug hint in production', async () => {
      // SENIOR ARCHITECT NOTE: source L129-132 conditionally appends a
      // debug hint ("Gelistirme icin SOC_STORAGE=memory ...") when
      // NODE_ENV !== 'production'. Production responses must NOT leak this
      // hint — it reveals deployment configuration details (specifically,
      // that SOC_STORAGE env var controls fallback behavior).
      //
      // This test stubs NODE_ENV='production', forces createSession to
      // throw, and verifies the response error string does NOT contain
      // the SOC_STORAGE hint. afterEach calls vi.unstubAllEnvs() to
      // restore.
      vi.stubEnv('NODE_ENV', 'production')
      vi.mocked(createSession).mockRejectedValueOnce(new Error('store failure'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(makePostRequest(validBody))

      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body.error).toBe('Kimlik dogrulama servisi su anda kullanilamiyor.')
      expect(body.error).not.toContain('SOC_STORAGE')

      // console.error captured the underlying error for operator forensics
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  // ─── R-04 timing leak (route-level surface) ────────────────────────────────

  describe('R-04 timing leak (route-level surface)', () => {
    it('T-LG12: Unknown username and wrong password produce IDENTICAL response (no enumeration via shape)', async () => {
      // SENIOR ARCHITECT NOTE: R-04 (High, A07) — username harvesting via
      // timing analysis. The actual leak is INSIDE authenticateUser at the
      // store layer (memory + supabase implementations both early-return
      // null on missing user without invoking scrypt; ~50ms gap between
      // known-username and unknown-username responses).
      //
      // ROUTE-LEVEL invariant tested here: the login route does NOT add an
      // enumeration vector via response shape. Both "user not found" and
      // "wrong password" cases collapse to authenticateUser returning null
      // (route.ts L57), and the route emits IDENTICAL 401 responses — same
      // status, same body. A regression that adds distinct error messages
      // (e.g., 404 'Kullanici bulunamadi' for missing user vs 401 'Hatali
      // sifre' for wrong pwd) would WORSEN R-04 by giving attackers an
      // instant oracle without timing.
      //
      // What the route DOESN'T do that would close R-04:
      //   - No timing equalization (e.g., dummy hashPassword call when user
      //     not found to match the ~50ms scrypt cost)
      //   - No fixed-delay per response
      //   - No constant-time comparison
      //
      // The leak survives at integration level. PHASE 5 / INTEGRATION TEST
      // SUITE will measure REAL timing via performance.now() with non-mocked
      // authenticateUser (OPTION A from Phase 1.D.12 plan):
      //
      //   const t1 = performance.now()
      //   await POST(unknownUserReq)
      //   const missingTime = performance.now() - t1
      //   const t2 = performance.now()
      //   await POST(wrongPwdReq)
      //   const wrongPwdTime = performance.now() - t2
      //   expect(missingTime).toBeLessThan(wrongPwdTime / 2)  // ~50ms gap
      //
      // That measurement requires real scrypt CPU and a populated test
      // store — out of Phase 1 scope (route-level mocked tests). When
      // Phase 1.5 hardening adds timing equalization (dummy hashPassword
      // call for missing user), the Phase 5 integration test gets flipped:
      //   expect(missingTime).toBeCloseTo(wrongPwdTime, -1)  // within 10ms
      //
      // REJECTED ALTERNATIVE (OPTION A here): real timing comparison via
      // performance.now() in this test. Rejected — flaky on CI under load
      // (shared runners, ~10ms scrypt jitter), and not meaningful when
      // authenticateUser is mocked (we'd be measuring the mock's resolution
      // latency, not real scrypt). Mock-based behavioral check (OPTION B,
      // this test) is deterministic; the timing measurement belongs in
      // Phase 5 integration test.
      vi.mocked(authenticateUser).mockResolvedValue(null)

      const r1 = await POST(makePostRequest({ username: 'unknownuser', password: 'whatever' }))
      const r2 = await POST(makePostRequest({ username: 'knownuser', password: 'wrongpass' }))

      // Identical status — both 401
      expect(r1.status).toBe(r2.status)
      expect(r1.status).toBe(401)

      // Identical body — same error message, no enumeration via shape
      const b1 = await r1.json()
      const b2 = await r2.json()
      expect(b1).toEqual(b2)
      expect(b1).toEqual({ error: 'Hatali kullanici adi veya sifre.' })
    })
  })
})
