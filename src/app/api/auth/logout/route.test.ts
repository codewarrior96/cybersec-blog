// SENIOR ARCHITECT NOTE: logout/route.ts is the simplest auth route — 4 module
// dependencies, no rate-limiting, no field validation, no scrypt. The route is
// idempotent by design: every call returns 200, every error is swallowed via
// console.error, and the cookie clear is unconditional. We mock soc-store-
// adapter (deleteSession + writeAuditLog) and auth-server (getRequestMetadata
// + getServerSessionFromRequest) at the module boundary. auth-shared
// (SESSION_COOKIE_NAME constant) is real.

vi.mock('@/lib/soc-store-adapter', () => ({
  deleteSession: vi.fn(),
  writeAuditLog: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
  getServerSessionFromRequest: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { deleteSession, writeAuditLog } from '@/lib/soc-store-adapter'
import { getRequestMetadata, getServerSessionFromRequest } from '@/lib/auth-server'
import { POST } from './route'

function makePostRequest(opts: { cookie?: string } = {}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.cookie !== undefined) headers.set('cookie', opts.cookie)
  return new NextRequest('https://localhost/api/auth/logout', {
    method: 'POST',
    headers,
  })
}

// Helper to extract Set-Cookie header value across runtime variations.
// Node 22 (vitest) has Headers.getSetCookie(); fallback to headers.get
// for older runtimes. Mirrors the helper in login/route.test.ts.
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

const mockSession = {
  user: {
    id: 1,
    username: 'user1',
    role: 'viewer' as const,
    emailVerified: true,
  },
  token: 'session-token-abc',
  expiresAt: '2099-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(getServerSessionFromRequest).mockResolvedValue(mockSession as never)
  vi.mocked(deleteSession).mockResolvedValue(undefined as never)
  vi.mocked(writeAuditLog).mockResolvedValue(undefined as never)
})

describe('logout/route POST', () => {
  // ─── Happy path + idempotency (T-LO01-03) ──────────────────────────────────

  describe('happy path + idempotency', () => {
    it('T-LO01: Cookie present → session deleted, audit logged, cookie cleared', async () => {
      // SENIOR ARCHITECT NOTE: success contract has THREE invariants:
      //   (1) deleteSession called with the cookie's token (revocation
      //       honored — the route delegates the actual revocation to
      //       the store via soc-store-adapter)
      //   (2) writeAuditLog called with action='auth.logout' + correct
      //       user id (forensic record preserved; this is the entry that
      //       R-17 documents as silently lost when the audit log throws)
      //   (3) Set-Cookie header clears the soc_session cookie (browser-
      //       side state cleared via Max-Age=0)
      // Any of these breaking means the logout is partial — server-side
      // revocation without client cookie clear, or vice versa, leaves the
      // session in a half-state.
      const response = await POST(makePostRequest({ cookie: 'soc_session=session-token-abc' }))

      // (1) deleteSession called with token
      expect(deleteSession).toHaveBeenCalledOnce()
      expect(deleteSession).toHaveBeenCalledWith('session-token-abc')

      // (2) Audit log
      expect(writeAuditLog).toHaveBeenCalledOnce()
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: mockSession.user.id,
          action: 'auth.logout',
          entityType: 'session',
          entityId: 'session-token-abc',
        }),
      )

      // (3) Response shape + cookie clear
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true })

      const setCookie = getSetCookieHeader(response)
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('soc_session=')
      expect(setCookie.toLowerCase()).toContain('max-age=0')
    })

    it('T-LO02: No cookie → 200 idempotent (deleteSession + writeAuditLog skipped)', async () => {
      // SENIOR ARCHITECT NOTE: idempotent logout. Calling logout when no
      // session exists must succeed silently — repeated logout calls
      // (common UX: user clicks logout twice, browser auto-retries on
      // network blip, multiple tabs hitting logout in parallel) shouldn't
      // error. Both downstream side effects (deleteSession, writeAuditLog)
      // are short-circuited by the truthy guards (L14, L22). Cookie clear
      // is unconditional — even with no incoming cookie, the response
      // includes Set-Cookie (cosmetic; harmless).
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest()) // no cookie

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true })

      // No revocation attempt (no token to revoke)
      expect(deleteSession).not.toHaveBeenCalled()
      // No audit log (no actor identity)
      expect(writeAuditLog).not.toHaveBeenCalled()

      // Cookie clear is unconditional — Set-Cookie still present
      const setCookie = getSetCookieHeader(response)
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('soc_session=')
    })

    it('T-LO03: Cookie present but session expired → 200, deleteSession called, no audit log', async () => {
      // SENIOR ARCHITECT NOTE: expired-session edge. Browser still holds
      // the cookie (e.g., user's tab was idle past expiresAt), so the
      // route observes:
      //   - cookie.value = 'expired-token' (truthy → deleteSession invoked
      //     for opportunistic store cleanup)
      //   - getServerSessionFromRequest returns null (validation rejects
      //     the expired token; HMAC may still verify but the expiresAt
      //     check fails)
      //
      // Result: deleteSession is called as a cleanup attempt (the store
      // may still have stale entries to evict — this is a defense-in-
      // depth garbage collection moment), but writeAuditLog is SKIPPED
      // because there's no actor identity (session.user.id missing).
      // Auditing a logout against an unknown actor would create a
      // phantom entry in the forensic record with entityId=token but no
      // actorUserId — confusing for SIEM consumers parsing the log.
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(null)

      const response = await POST(makePostRequest({ cookie: 'soc_session=expired-token' }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true })

      // deleteSession CALLED (token present, opportunistic cleanup)
      expect(deleteSession).toHaveBeenCalledOnce()
      expect(deleteSession).toHaveBeenCalledWith('expired-token')

      // writeAuditLog NOT called (session null → no actor identity)
      expect(writeAuditLog).not.toHaveBeenCalled()
    })
  })

  // ─── Error swallowing (T-LO04, R-17) ───────────────────────────────────────

  describe('error swallowing (R-17)', () => {
    it('T-LO04: deleteSession throws → swallowed, 200 returned (R-17 pattern)', async () => {
      // SENIOR ARCHITECT NOTE: R-17 (Medium, A09) — swallow-failure pattern.
      // The audit row maps T-LO04 to R-17, but precision matters here.
      //
      // R-17's LITERAL TARGET: source L31-33 (writeAuditLog swallow).
      // R-17 audit description (Section 2): "writeAuditLog failures
      // swallowed silently; critical events (login, password_reset,
      // account_delete) can be lost."
      //
      // SOURCE HAS TWO DISTINCT SWALLOW PATHS:
      //   (a) L15-19: deleteSession swallow
      //         try { await deleteSession(token) } catch { console.error }
      //       Effect: revocation failure silently dropped — token may
      //       remain valid in store after "successful" logout response.
      //       Compounds R-19's distributed logout failure.
      //
      //   (b) L31-33: writeAuditLog swallow ← R-17's literal target
      //         try { await writeAuditLog({...}) } catch { console.error }
      //       Effect: forensic record gap — logout event vanishes from
      //       audit trail with no operator alarm. Same anti-pattern lives
      //       in login/route.ts, register/route.ts, and reset routes.
      //
      // T-LO04 PROBES BOTH PATHS:
      //   - PRIMARY: deleteSession throws → response still 200, console.
      //     error called (path (a) verified directly).
      //   - PARALLEL: writeAuditLog STILL CALLED despite deleteSession
      //     failure (path (b) reached — the swallow at (a) does NOT
      //     short-circuit (b), so subsequent failures at (b) would also
      //     be swallowed under the same pattern). This indirectly
      //     confirms R-17's literal path is reachable in the logout
      //     code flow.
      //
      // For future audit revision: consider adding a separate test row
      // (T-LO04b or new ID) that explicitly mocks writeAuditLog to throw
      // while deleteSession succeeds, isolating R-17's literal path.
      // Current T-LO04 covers both via the parallel-path probe but a
      // dedicated test would be cleaner mapping to the literal R-17.
      //
      // PHASE 1.5 HARDENING: structured error reporting + alerting
      // pipeline. When that lands:
      //   - console.error → still called (kept for log archeology)
      //   - + alertingSpy.toHaveBeenCalled() → new assertion added
      //   - silent swallow becomes loud-but-non-blocking
      vi.mocked(deleteSession).mockRejectedValueOnce(new Error('store unreachable'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(makePostRequest({ cookie: 'soc_session=session-token-abc' }))

      // PRIMARY: 200 returned despite deleteSession failure (swallow path (a))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true })

      // deleteSession was attempted (and threw)
      expect(deleteSession).toHaveBeenCalledOnce()

      // console.error called from L18 (the swallow log)
      expect(errorSpy).toHaveBeenCalled()

      // PARALLEL: writeAuditLog STILL called — the swallow at (a) does
      // NOT short-circuit (b). This proves the route reaches the audit-
      // log path even after deleteSession failure, demonstrating that
      // R-17's literal target (writeAuditLog at L22-34) is reachable in
      // this code path and would suffer the same swallow if it threw.
      expect(writeAuditLog).toHaveBeenCalledOnce()

      errorSpy.mockRestore()
    })
  })

  // ─── Cookie clearing (T-LO05) ──────────────────────────────────────────────

  describe('cookie clearing', () => {
    it('T-LO05: Cookie maxAge=0 in Set-Cookie (explicit clear attribute)', async () => {
      // SENIOR ARCHITECT NOTE: cookie clearing contract. Source L37-45
      // sets value='' + maxAge=0. Browser interprets Max-Age=0 as
      // immediate expiry and removes the cookie. A regression that omits
      // maxAge (or uses maxAge=undefined) would leave the cookie in the
      // browser at its original Max-Age (30 days from login), defeating
      // the logout UX — the user "logged out" but the cookie persists,
      // and any subsequent request re-attaches it.
      const response = await POST(makePostRequest({ cookie: 'soc_session=session-token-abc' }))

      const setCookie = getSetCookieHeader(response)
      expect(setCookie).toBeTruthy()
      // Explicit Max-Age=0 attribute (not Max-Age=2592000 from login)
      expect(setCookie.toLowerCase()).toContain('max-age=0')
      expect(setCookie).toContain('soc_session=')
    })
  })

  // ─── R-19 distributed logout (route-level surface) ─────────────────────────

  describe('R-19 distributed logout (route-level surface)', () => {
    it('T-LO06: deleteSession called with token (R-19 route invariant; multi-instance leak persists at store layer)', async () => {
      // SENIOR ARCHITECT NOTE: R-19 (High, A07) — distributed logout
      // fails when memory store is the active backend. Patterned
      // identically to T-LG12 (R-04 timing leak): route-level invariant
      // + persistent gap documented + hardening proposal + scope
      // clarification + REJECTED ALTERNATIVE.
      //
      // ROUTE-LEVEL INVARIANT: the route HONORS the revocation contract
      // by calling deleteSession(token) on every logout with a present
      // cookie (source L16). This test confirms the contract is honored
      // — the route does not silently skip revocation, does not
      // delegate to alternate primitives, does not have a dead-code
      // path that bypasses deleteSession.
      //
      // PERSISTENT GAP (route-level test cannot probe): R-19's actual
      // leak is in soc-store-memory.ts. Memory store sessions are
      // HMAC-signed self-contained tokens (the token IS the session
      // payload — userId, role, expiresAt all encoded in the signed
      // string). Revocation tracking lives in an in-memory
      // Set<string> called `revokedTokens`. That Set is process-local
      // — it does not propagate across instances.
      //
      // MULTI-INSTANCE FAILURE MODE (concrete walk-through):
      //   1. Vercel deployment with N=3 warm instances, all running
      //      soc-store-memory (R-03 fallback active or SOC_STORAGE=
      //      memory by config).
      //   2. User logs in → session token T issued (HMAC-signed,
      //      deterministic — any instance can verify T without
      //      consulting shared state).
      //   3. User clicks logout → request lands on Instance A.
      //      - Instance A's deleteSession adds T to its revokedTokens
      //        Set.
      //      - Instance A returns 200, response cookie cleared in
      //        browser via Max-Age=0.
      //   4. Browser still has T in localStorage / kept the cookie
      //      before clear took effect / attacker captured T from a
      //      proxy log / extension.
      //   5. Subsequent request with T lands on Instance B (load-
      //      balancer routing).
      //      - Instance B's revokedTokens Set is EMPTY (never
      //        received the revocation signal — there is NO signal
      //        mechanism in soc-store-memory).
      //      - HMAC validates (T was legitimately signed, MEMORY_
      //        SECRET shared via env).
      //      - Session reconstructed from token payload → request
      //        authorized.
      //   6. Logout effectively no-op across the cluster. Token
      //      remains usable until natural expiry (30 days for
      //      remember=true). The user believes they logged out;
      //      the attacker (or stolen cookie) sees no change.
      //
      // HARDENING PROPOSALS (out of route-level scope, deferred to
      // Phase 1.5 or storage migration):
      //   (a) Redis pub-sub session blacklist: deleteSession publishes
      //       T to a channel (e.g., 'session:revoke'); all instances
      //       subscribe and update their local revokedTokens Sets.
      //       Bounded eventual consistency (~ms propagation across
      //       cluster). Adds Redis as an infrastructure dependency.
      //   (b) DB persistent revocation table: revokedTokens persisted
      //       in Postgres/Supabase. All instances read the table on
      //       session validation. Slower (DB hit per request) but
      //       deterministic and matches the existing supabase
      //       infrastructure. Suits the project's current store
      //       architecture.
      //   (c) Short JWT TTL (1-5 min) + refresh-token rotation: the
      //       window during which a revoked token remains valid is
      //       naturally bounded by TTL expiry. Doesn't fully close
      //       the gap but limits exposure to a few minutes per
      //       revocation. Industry-standard pattern (Auth0, Cognito).
      //
      // The R-03 dependency is critical: R-19 only manifests when
      // memory store is the active session backend. Production
      // deployments using supabase identity store (default per A-10
      // finding) don't suffer R-19 because supabase's deleteSession
      // is a DB write — single source of truth across all instances.
      //
      // PHASE 2/5 SCOPE: direct multi-instance simulation requires
      // spinning up two memory store instances (different module
      // imports with separate state) and verifying instance B doesn't
      // honor instance A's revocation. This is storage-layer test
      // territory (Phase 2 storage suite or Phase 5 integration),
      // not route-layer scope.
      //
      // REJECTED ALTERNATIVE: simulate multi-instance behavior at
      // route level by importing the route fresh between calls and
      // giving each import a different store instance via vi.doMock
      // cycling. Rejected — the leak is intrinsic to the store's
      // data structure (per-process Set), not to anything the route
      // can or should be testing. Adding this complexity here would
      // obscure the route's actual contract (call deleteSession)
      // without surfacing the gap any more clearly than this comment
      // block + the future Phase 2 store test will.
      //
      // What this test asserts: route-level invariant only. The
      // comment block carries the gap documentation; if T-LO06 ever
      // fails, the route's revocation contract is broken and that's
      // a separate (more urgent) bug, distinct from R-19's
      // distribution problem.
      const response = await POST(makePostRequest({ cookie: 'soc_session=session-token-abc' }))

      expect(response.status).toBe(200)
      expect(deleteSession).toHaveBeenCalledOnce()
      expect(deleteSession).toHaveBeenCalledWith('session-token-abc')
    })
  })
})
