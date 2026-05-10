import { NextRequest } from 'next/server'
import { middleware } from './middleware'

// SENIOR ARCHITECT NOTE: middleware.ts has only ONE external dependency
// (`SESSION_COOKIE_NAME` const from auth-shared) — no module-boundary mocks
// are needed. We construct real NextRequest instances via the standard
// constructor; middleware reads request.method, request.nextUrl.host,
// request.nextUrl.pathname, request.headers.get('origin'/'referer'), and
// request.cookies.get(SESSION_COOKIE_NAME). All of these are populated
// correctly by NextRequest's URL/Headers parsing.
// REJECTED ALTERNATIVE: minimal mock (`{ url, method, headers, cookies, nextUrl } as any`).
// Rejected — real NextRequest gives faithful host parsing (URL → host) and
// cookie parsing (Cookie header → RequestCookies map) without per-test
// stubbing. The cost is slightly more verbose construction; the benefit is
// that the test exercises the same parsing path the production middleware
// runtime uses, catching parser-edge regressions for free.

interface MakeRequestOpts {
  method?: string
  pathname?: string
  origin?: string
  referer?: string
  cookie?: string
  host?: string
}

function makeRequest(opts: MakeRequestOpts = {}): NextRequest {
  const host = opts.host ?? 'localhost'
  const url = `https://${host}${opts.pathname ?? '/api/foo'}`
  const headers = new Headers()
  if (opts.origin !== undefined) headers.set('origin', opts.origin)
  if (opts.referer !== undefined) headers.set('referer', opts.referer)
  if (opts.cookie !== undefined) headers.set('cookie', opts.cookie)
  return new NextRequest(url, { method: opts.method ?? 'GET', headers })
}

const VALID_ORIGIN = 'https://localhost'
const VALID_COOKIE = 'soc_session=test-token-value'

describe('middleware', () => {
  // ─── CSRF check (csrfCheck) — Origin/Referer host matching ──────────────────

  describe('CSRF check', () => {
    it('T-MW02: Mismatched Origin → 403 Origin mismatch', async () => {
      // SENIOR ARCHITECT NOTE: standard CSRF defense — a request claiming
      // Origin from a different host is rejected at the edge before any
      // route handler runs. Maps to OWASP A01 (Broken Access Control)
      // cross-site request forgery sub-category.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/alerts',
        origin: 'https://evil.example.com',
        cookie: VALID_COOKIE,
      })

      const response = middleware(request)

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body).toEqual({ error: 'Origin mismatch' })
    })

    it('T-MW03: No Origin AND no Referer on POST → 403 (default-deny)', async () => {
      // SENIOR ARCHITECT NOTE: defense-in-depth default. extractClaimedHost
      // returns null when both Origin and Referer headers are absent (or
      // unparseable). The check `claimedHost === null || !== requestHost`
      // short-circuits to 403 — origin-less mutations are FAIL-SECURE, not
      // permitted. Some browsers strip Origin in privacy-protective contexts
      // (cross-origin redirects, some sandboxed iframes, HTTPS→HTTP); in
      // those cases the absence of BOTH headers is the only signal, and
      // the default must be reject.
      // REJECTED ALTERNATIVE: pass through if both absent, treating "no
      // signal" as "trusted same-origin." Rejected — the OWASP CSRF cheat
      // sheet explicitly recommends rejecting requests where the origin
      // cannot be determined. Permissive fallback breaks the threat model.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/alerts',
        // intentionally no origin, no referer
        cookie: VALID_COOKIE,
      })

      const response = middleware(request)

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body).toEqual({ error: 'Origin mismatch' })
    })

    it('T-MW08: POST with Referer matching host (no Origin) → passes CSRF', () => {
      // SENIOR ARCHITECT NOTE: Origin header is the primary CSRF signal,
      // but some browsers (older Safari, certain Firefox configs) and
      // privacy-enhanced contexts may suppress Origin while still sending
      // Referer. The middleware's extractClaimedHost falls back to Referer
      // — Origin first (L61-68), Referer second (L69-77). This test
      // confirms the fallback path works for legitimate same-origin
      // requests where Origin was stripped.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/alerts',
        // no origin
        referer: 'https://localhost/dashboard',
        cookie: VALID_COOKIE,
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('T-MW09: POST with malformed Origin → 403 (defensive default)', async () => {
      // SENIOR ARCHITECT NOTE: extractClaimedHost wraps `new URL(originHeader)`
      // in try/catch (L62-67). An unparseable Origin (`'not a url'`,
      // empty string, garbage bytes) throws on the URL constructor and
      // the catch returns null. Then csrfCheck sees claimedHost=null and
      // emits 403 — the malformed signal is treated as no signal, which
      // is treated as fail-secure.
      //
      // This matters because attacker-controlled headers can carry
      // arbitrary content; the defensive parser ensures invalid input
      // produces a deterministic reject, not a parser exception that
      // crashes the request pipeline (which could degrade to 500 and
      // accidentally leak via error pages).
      // REJECTED ALTERNATIVE: assert response is non-200. Rejected — that
      // would also pass on a 500 (parser exception). Pinning 403 confirms
      // the defensive catch fires AND the standard CSRF reject is emitted.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/alerts',
        origin: 'not a url',  // malformed
        cookie: VALID_COOKIE,
      })

      const response = middleware(request)

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body).toEqual({ error: 'Origin mismatch' })
    })
  })

  // ─── Session presence (sessionPresenceCheck) ────────────────────────────────

  describe('session presence', () => {
    it('T-MW01: POST with matching Origin + session cookie passes both gates', () => {
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/alerts',
        origin: VALID_ORIGIN,
        cookie: VALID_COOKIE,
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('T-MW04: Valid Origin, no session cookie on protected route → 401 source=edge', async () => {
      // SENIOR ARCHITECT NOTE: defense-in-depth cookie-presence check.
      // The middleware does NOT validate the session (no DB lookup, no
      // signature verify) — that authoritative check lives in route
      // handlers via api-auth.requireSession. The edge-level presence
      // check is a cheap early-reject for obviously unauthenticated
      // mutations, sparing the route handler from spinning up.
      //
      // The `source: 'edge'` field is consumed by middleware/UI to
      // distinguish edge-level rejects from route-level rejects (which
      // emit `source: 'route'` per api-auth.ts L18). A regression that
      // drops `source` would silently break that signal.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/alerts',
        origin: VALID_ORIGIN,
        // no cookie — session presence check fires
      })

      const response = middleware(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body).toEqual({ error: 'Oturum gerekli.', source: 'edge' })
    })

    it('T-MW10: DELETE with valid Origin + cookie → passes both gates', () => {
      // DELETE is in MUTATING_METHODS, so both CSRF and session checks
      // fire. Test confirms DELETE follows the same path as POST.
      const request = makeRequest({
        method: 'DELETE',
        pathname: '/api/alerts/1',
        origin: VALID_ORIGIN,
        cookie: VALID_COOKIE,
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    })
  })

  // ─── Public API routes (PUBLIC_API_ROUTES bypass for session check) ─────────

  describe('public API routes', () => {
    it('T-MW05: POST /api/auth/login (public) passes without cookie', () => {
      // SENIOR ARCHITECT NOTE: /api/auth/login is in PUBLIC_API_ROUTES
      // because credential submission BY DEFINITION arrives without a
      // session cookie — that's what login produces. Bypassing the
      // session check here is necessary, not a vulnerability. CSRF
      // check still fires (Origin must match), preventing cross-origin
      // credential stuffing.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/auth/login',
        origin: VALID_ORIGIN,
        // no cookie — PUBLIC_API_ROUTES bypasses session check
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('T-MW06: POST /api/auth/logout (public) passes without cookie — R-16 regression guard, CSRF-mitigated', () => {
      // SENIOR ARCHITECT NOTE: R-16 (Low, A04) regression guard with
      // CORRECTED NARRATIVE (see pending amendments A-11). Original audit
      // description claimed "CSRF-able logout possible" — source analysis
      // proves this is largely mitigated by the CSRF gate.
      //
      // PUBLIC_API_ROUTES bypass scope: ONLY the sessionPresenceCheck
      // (cookie-presence gate, middleware.ts L92-101) is bypassed for
      // these paths. The csrfCheck (L80-90) ALWAYS fires on every
      // mutation regardless of PUBLIC_API_ROUTES membership; it runs
      // FIRST in the middleware function (L106-107). PUBLIC_API_ROUTES
      // exempts ONE gate, not BOTH.
      //
      // Logout route surface (src/app/api/auth/logout/route.ts):
      //   - exports POST only, NO GET handler
      //   - GET request → Next.js returns 405 Method Not Allowed before
      //     any custom logic runs
      //   - `<img src="https://victim/api/auth/logout">` GET-CSRF →
      //     405, never reaches middleware/route
      //
      // Cross-origin POST attack walk-through:
      //   <form action="https://victim/api/auth/logout" method="POST">
      //   auto-submitted from attacker.com → browser sets Origin:
      //   https://attacker.com (Fetch spec: forbidden header, JS cannot
      //   override) → middleware csrfCheck reads claimedHost='attacker.com',
      //   requestHost='victim.com' → mismatch → 403 'Origin mismatch'.
      //   Attack blocked at the edge before logout logic runs.
      //
      // RESIDUAL R-16 SURFACE (after CSRF mitigation): only same-origin
      // XSS. A script running on victim.com can fetch /api/auth/logout
      // with credentials → Origin matches → CSRF passes → PUBLIC_API_ROUTES
      // bypasses session check → logout succeeds. But this requires
      // existing XSS, which is its own risk class. R-16's incremental
      // contribution beyond "you have XSS" is informational at best.
      //
      // This test asserts: documented current behavior — POST to
      // /api/auth/logout with valid Origin and NO cookie passes the
      // middleware (intentional design for clean idempotent logout).
      //
      // HARDENING LANDING: if /api/auth/logout is removed from
      // PUBLIC_API_ROUTES (Phase 1.5 hardening), this assertion flips to
      // expect 401 — cookie-less POST would fail session presence check
      // even when Origin is valid.
      //
      // REJECTED ALTERNATIVE: assert PUBLIC_API_ROUTES inclusion directly.
      // The Set is private (not exported). Behavioral probe via this test
      // is the only regression-detectable signal. Exporting the constant
      // for test convenience widens the public surface — not worth it.
      const request = makeRequest({
        method: 'POST',
        pathname: '/api/auth/logout',
        origin: VALID_ORIGIN,
        // no cookie — would 401 normally, but PUBLIC_API_ROUTES bypasses
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    })
  })

  // ─── Non-mutating method bypass ─────────────────────────────────────────────

  describe('non-mutating method bypass', () => {
    it('T-MW07: GET /api/auth/session bypasses both gates (no Origin, no cookie required)', () => {
      // SENIOR ARCHITECT NOTE: GET/HEAD/OPTIONS are not in MUTATING_METHODS
      // (middleware.ts L33). Both csrfCheck (L81) and sessionPresenceCheck
      // (L93) early-return null on non-mutating methods. CSRF defense
      // doesn't apply to read-only requests (CSRF is a write-side concern);
      // session presence isn't enforced because the GET endpoint itself
      // returns the session state (or null for unauthenticated callers).
      // Both behaviors are by design.
      const request = makeRequest({
        method: 'GET',
        pathname: '/api/auth/session',
        // no origin, no cookie — non-mutating bypass
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    })
  })

  // ─── Non-API branch (header rewrite) ────────────────────────────────────────

  describe('non-API branch', () => {
    it('T-MW11: GET /home → passes, x-pathname header forwarded to downstream', () => {
      // SENIOR ARCHITECT NOTE: non-API branch (middleware.ts L115-131).
      // Headers are mutated (x-pathname injected) and forwarded via
      // NextResponse.next({ request: { headers } }). The Next.js runtime
      // exposes header overrides via `x-middleware-override-headers`
      // (comma-separated list of overridden header names) and
      // `x-middleware-request-x-pathname` (the new value) on the response.
      // Asserting on these contract markers verifies the override mechanism
      // is wired correctly without depending on Next.js internal details.
      //
      // REJECTED ALTERNATIVE: spy on NextResponse.next and inspect args.
      // Rejected — that requires module-boundary mocking of NextResponse,
      // which complicates the test harness and breaks the rule that
      // middleware.ts needs no external mocks. Reading response markers
      // is a stable contract surface.
      const request = makeRequest({
        method: 'GET',
        pathname: '/home',
        host: 'localhost',
      })

      const response = middleware(request)

      expect(response.status).toBe(200)
      const overrides = response.headers.get('x-middleware-override-headers')
      expect(overrides).toContain('x-pathname')
    })
  })
})
