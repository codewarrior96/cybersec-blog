import type { NextRequest } from 'next/server'
import type { SessionRecord } from '@/lib/soc-store-adapter'
import type { UserRole } from '@/lib/soc-types'

// SENIOR ARCHITECT NOTE: getServerSessionFromRequest is the single I/O boundary
// of api-auth.ts — it performs cookie parse + session store lookup. Mocking it
// gives us deterministic control over "is the user authenticated, and as whom?"
// without standing up the entire auth-server + session-store stack.
// hasRoleAtLeast (auth-shared) is intentionally NOT mocked — it is a pure
// function unit-tested in Phase 1.D.6 (T-AS01-09), and using it real here
// produces an integration check: if a future refactor breaks role hierarchy,
// these tests catch it too. Defense-in-depth via real-call where safe.
// REJECTED ALTERNATIVE: also mock hasRoleAtLeast — rejected because mocking a
// trivially pure function buys nothing, and isolating it would let role-
// hierarchy bugs slip through requireRole's integration surface.
vi.mock('@/lib/auth-server', () => ({
  getServerSessionFromRequest: vi.fn(),
}))

import { getServerSessionFromRequest } from '@/lib/auth-server'
import { requireSession, requireRole } from './api-auth'

// Minimal request stub — the function passes `request` through to the mocked
// getServerSessionFromRequest before reading any property, so a bare object
// suffices. No NextRequest construction needed.
const fakeReq = {} as unknown as NextRequest

function makeSession(role: UserRole): SessionRecord {
  return {
    token: 'test-token',
    user: {
      id: 1,
      username: 'tester',
      role,
      emailVerified: true,
    },
    expiresAt: '2099-01-01T00:00:00Z',
  }
}

describe('api-auth', () => {
  // ─── requireSession ──────────────────────────────────────────────────────────

  describe('requireSession', () => {
    it('T-AA01: valid session → {session, response: null}', async () => {
      const session = makeSession('admin')
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(session)

      const result = await requireSession(fakeReq)

      expect(result.session).toEqual(session)
      expect(result.response).toBeNull()
    })

    it('T-AA02: no session → 401 with "Oturum gerekli." body', async () => {
      // SENIOR ARCHITECT NOTE: assert both status code AND body shape. The
      // body's `source: 'route'` field is consumed by middleware/UI to
      // distinguish route-level auth failures from middleware-level ones —
      // a regression that drops `source` would silently break that signal.
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(null)

      const result = await requireSession(fakeReq)

      expect(result.session).toBeNull()
      expect(result.response).not.toBeNull()
      expect(result.response?.status).toBe(401)
      const body = await result.response!.json()
      expect(body).toEqual({ error: 'Oturum gerekli.', source: 'route' })
    })
  })

  // ─── requireRole ─────────────────────────────────────────────────────────────

  describe('requireRole', () => {
    it('T-AA03: sufficient role (admin satisfies analyst) → response null, session passes through', async () => {
      const session = makeSession('admin')
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(session)

      const result = await requireRole(fakeReq, 'analyst')

      expect(result.response).toBeNull()
      expect(result.session).toEqual(session)
    })

    it('T-AA04: insufficient role (viewer requires admin) → 403, session still returned', async () => {
      // SENIOR ARCHITECT NOTE: when authz fails the function returns the
      // session ALONGSIDE the 403 response. This is intentional — callers
      // (route handlers) need session.user.id to write an audit log entry
      // documenting WHO attempted the unauthorized action. A regression
      // that drops session on 403 would silently break forensic logging
      // for failed-authz events.
      // REJECTED ALTERNATIVE: assert session === null on 403 — rejected,
      // that would be the WRONG behavior. The test guards the audit
      // contract.
      const session = makeSession('viewer')
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(session)

      const result = await requireRole(fakeReq, 'admin')

      expect(result.response).not.toBeNull()
      expect(result.response?.status).toBe(403)
      expect(result.session).toEqual(session)
      const body = await result.response!.json()
      expect(body).toEqual({ error: 'Bu islem icin yetkiniz yok.' })
    })

    it('T-AA05: no session on requireRole → 401 NOT 403 (auth before authz, OWASP A01)', async () => {
      // SENIOR ARCHITECT NOTE: OWASP A01 (Broken Access Control) — the order
      // of checks matters. requireRole MUST run authentication first; only
      // an authenticated user can fail an authorization check. If this test
      // ever returns 403, an unauthenticated request is being told "you
      // need higher role" — which leaks the existence of the protected
      // endpoint to anonymous callers and inverts the standard response
      // hierarchy (401 = who are you?, 403 = I know who you are but no).
      //
      // Source enforcement: api-auth.ts L26-27 — `requireRole` calls
      // `requireSession` first, returns guarded immediately if session is
      // null. The 403 branch is unreachable without a valid session.
      //
      // REJECTED ALTERNATIVE: assert response is non-null only. Rejected
      // because that would pass even on the wrong status (403). Pinning
      // the exact status to 401 is the precise A01 guard.
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(null)

      const result = await requireRole(fakeReq, 'analyst')

      expect(result.session).toBeNull()
      expect(result.response).not.toBeNull()
      expect(result.response?.status).toBe(401)
      const body = await result.response!.json()
      expect(body).toEqual({ error: 'Oturum gerekli.', source: 'route' })
    })

    it('T-AA06: viewer cannot pass requireRole(analyst) — adjacent-boundary insufficient', async () => {
      // SENIOR ARCHITECT NOTE: paired with T-AA04. T-AA04 probes the
      // 2-level gap (viewer requires admin); T-AA06 probes the 1-level
      // adjacent gap (viewer requires analyst — the very next role up).
      // Both code paths run identical logic (hasRoleAtLeast → false → 403),
      // but defense-in-depth wants both boundary distances tested: a
      // future hierarchy refactor could subtly miscompute the "exactly one
      // step short" case while still passing the "two steps short" case.
      // REJECTED ALTERNATIVE: collapse T-AA04 and T-AA06 into one test —
      // rejected because audit Section 5 lists them separately and the
      // adjacent-boundary probe has independent regression value.
      const session = makeSession('viewer')
      vi.mocked(getServerSessionFromRequest).mockResolvedValueOnce(session)

      const result = await requireRole(fakeReq, 'analyst')

      expect(result.response?.status).toBe(403)
      expect(result.session).toEqual(session)
    })
  })
})
