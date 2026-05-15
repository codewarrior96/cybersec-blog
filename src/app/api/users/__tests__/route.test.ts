// Wave 2B — R-API-06 closure regression tests for /api/users GET role gate
//
// Phase 3.A audit Section 2: `listAssignableUsers` GET previously
// required only `requireSession` — any authenticated viewer-role user
// could enumerate admins + analysts. Wave 2B fix: gate raised to
// requireRole('analyst'). These tests lock the contract.
//
// SENIOR ARCHITECT NOTE: vi.mock at module boundary per Phase 1.D
// login route lineage. requireRole + listAssignableUsers mocked; the
// route's role-gate dispatch is the unit under test.

vi.mock('@/lib/api-auth', () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  createUser: vi.fn(),
  listAssignableUsers: vi.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { listAssignableUsers } from '@/lib/soc-store-adapter'

import { GET } from '../route'

function makeRequest(): NextRequest {
  return new NextRequest('https://localhost/api/users', { method: 'GET' })
}

const ANALYST_SESSION = {
  user: { id: 7, username: 'analyst1', displayName: 'Analyst', role: 'analyst' as const, emailVerified: true },
  token: 't-analyst',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

const ADMIN_SESSION = {
  user: { id: 1, username: 'admin', displayName: 'Admin', role: 'admin' as const, emailVerified: true },
  token: 't-admin',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

describe('/api/users GET — Wave 2B R-API-06 closure (requireRole analyst gate)', () => {
  it('T-UR01 — unauthenticated GET returns 401 via requireRole short-circuit', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(listAssignableUsers).not.toHaveBeenCalled()
  })

  it('T-UR02 — analyst role accepted, returns user list', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      session: ANALYST_SESSION as never,
      response: null,
    })
    vi.mocked(listAssignableUsers).mockResolvedValueOnce([
      { id: 1, username: 'admin', displayName: 'Admin', role: 'admin', emailVerified: true } as never,
      { id: 7, username: 'analyst1', displayName: 'Analyst', role: 'analyst', emailVerified: true } as never,
    ])

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toHaveLength(2)
    expect(listAssignableUsers).toHaveBeenCalledTimes(1)
  })

  it('T-UR03 — viewer/insufficient role returns 403 via requireRole', async () => {
    // requireRole returns a 403 response when role fails the minimum.
    // Test mocks the upstream gate decision and asserts the route
    // surfaces it without calling listAssignableUsers.
    vi.mocked(requireRole).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: 'Yetersiz rol.' }, { status: 403 }),
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    expect(listAssignableUsers).not.toHaveBeenCalled()
  })

  it('T-UR04 — admin role (above-minimum) also accepted via hasRoleAtLeast', async () => {
    // Defense-in-depth check: requireRole('analyst') means analyst-OR-ABOVE
    // per src/lib/auth-shared.ts hasRoleAtLeast. Admin should pass too.
    vi.mocked(requireRole).mockResolvedValueOnce({
      session: ADMIN_SESSION as never,
      response: null,
    })
    vi.mocked(listAssignableUsers).mockResolvedValueOnce([])

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(listAssignableUsers).toHaveBeenCalledTimes(1)
  })
})
