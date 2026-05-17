// SENIOR ARCHITECT NOTE: session/route.ts is the smallest auth route — 18 lines,
// one external dependency (getServerSessionFromRequest from auth-server),
// GET-only, no side effects. We mock auth-server at the module boundary;
// next/server runtime is real.

vi.mock('@/lib/auth-server', () => ({
  getServerSessionFromRequest: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { getServerSessionFromRequest } from '@/lib/auth-server'
import { GET } from './route'

function makeGetRequest(opts: { cookie?: string } = {}): NextRequest {
  const headers = new Headers()
  if (opts.cookie !== undefined) headers.set('cookie', opts.cookie)
  return new NextRequest('https://localhost/api/auth/session', {
    method: 'GET',
    headers,
  })
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

describe('session/route GET', () => {
  it('T-SS01: Valid cookie → 200 authenticated:true', async () => {
    // SENIOR ARCHITECT NOTE: response contract has THREE fields the
    // frontend depends on:
    //   - authenticated: boolean (UI gates rendering on this)
    //   - user: SessionUser object (header avatar, profile route)
    //   - expiresAt: ISO string (client may auto-logout near expiry)
    // Missing any of these breaks UI render or logout-timer logic.
    //
    // SLIDING WINDOW (by design, NOT applied here): the route is read-
    // only and does NOT refresh session.expiresAt on access. expiresAt
    // remains the value set at createSession time. A user idle for
    // 29.9 days then probing /api/auth/session sees the same expiry
    // they were issued at login — no extension. Phase 1.5 hardening
    // backlog could add sliding-window refresh (industry pattern:
    // GitHub, Stripe), but the current contract is fixed expiry.
    vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(mockSession as never)

    const response = await GET(makeGetRequest({ cookie: 'soc_session=session-token-abc' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      authenticated: true,
      user: mockSession.user,
      expiresAt: mockSession.expiresAt,
    })
  })

  it('T-SS02: No cookie → 200 authenticated:false', async () => {
    // SENIOR ARCHITECT NOTE: status 200 (NOT 401) for unauthenticated
    // is intentional — frontend "am I logged in?" probe should be
    // exception-free. UI reads body.authenticated boolean and renders;
    // no try/catch on 401 needed. This is the "cold state" entry point
    // (browser without cookie), paired with T-SS03's "stale cookie"
    // entry point.
    //
    // Same code path, different scenario intent: T-SS02 (cold state,
    // no cookie) and T-SS03 (stale cookie, store reject) both produce
    // identical response shape. This is a privacy/UX invariant: user
    // cannot distinguish 'never logged in' from 'session expired' via
    // this endpoint. Both tests assert the invariant from different
    // entry points.
    vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(null)

    const response = await GET(makeGetRequest()) // no cookie

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      authenticated: false,
      user: null,
    })
  })

  it('T-SS03: Cookie present but store returns null → 200 authenticated:false', async () => {
    // SENIOR ARCHITECT NOTE: paired with T-SS02. The user's browser
    // still holds soc_session=stale-token in its cookie jar (e.g.,
    // session expired server-side after 30 days, or a logout from
    // another device revoked the token, or store-layer cleanup
    // evicted it). getServerSessionFromRequest validates the token
    // against the active store and returns null because no matching
    // active session exists. The route emits the same response as
    // T-SS02.
    //
    // Same code path, different scenario intent: T-SS02 (cold state,
    // no cookie) and T-SS03 (stale cookie, store reject) both produce
    // identical response shape. This is a privacy/UX invariant: user
    // cannot distinguish 'never logged in' from 'session expired' via
    // this endpoint. Both tests assert the invariant from different
    // entry points.
    //
    // REJECTED ALTERNATIVE: distinguish stale cookie from no cookie
    // (e.g., return body.reason='expired' for stale tokens). Rejected
    // — that would leak the existence of a prior session to anyone
    // who guesses or steals a token (fixed-string oracle). The
    // identical-response invariant is the privacy contract.
    vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(null)

    const response = await GET(makeGetRequest({ cookie: 'soc_session=stale-token' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      authenticated: false,
      user: null,
    })
  })
})
