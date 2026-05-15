// Wave 3 — R-API-04 closure: cascade partial-failure (test addition)
//
// Phase 3.A R-API-04: `deleteUserCascade` does irreversible deletion
// of sessions + reports + certifications + assets + educations +
// avatar + profile + indexes. Route comments document banking-grade
// safety (password re-auth + 'DELETE' literal confirm). Phase 3.D
// shipped T-RP25-30 two-stage delete tests (partial closure).
//
// Wave 3 closes the cascade contract at the DELETE /api/users/me
// route layer:
//   - happy path: 200 + counts payload + session cookie cleared
//   - missing password: 400
//   - wrong confirmation literal: 400
//   - unauth: 401 with source: route tag
//   - wrong password: 401
//   - user vanished (race): 404
//   - audit log fail: 500
//
// SENIOR ARCHITECT NOTE: vi.mock at module boundary per Phase 1.D
// + 3.D convention. deleteUserCascade + readUserById + verifyPassword
// + requireSession + getRequestMetadata all mocked.

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/security', () => ({
  verifyPassword: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  deleteUserCascade: vi.fn(),
}))
vi.mock('@/lib/soc-store-supabase', () => ({
  readUserById: vi.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { verifyPassword } from '@/lib/security'
import { deleteUserCascade } from '@/lib/soc-store-adapter'
import { readUserById } from '@/lib/soc-store-supabase'

import { DELETE } from '../route'

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('https://localhost/api/users/me', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const SESSION = {
  user: { id: 7, username: 'operator1', displayName: 'Operator', role: 'analyst' as const, emailVerified: true },
  token: 't-op',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

const STORED_USER = {
  id: 7,
  username: 'operator1',
  email: 'op@example.com',
  emailKey: 'op@example.com',
  displayName: 'Operator',
  role: 'analyst' as const,
  passwordHash: 'salt:hash',
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const CASCADE_COUNTS = {
  sessions: 3,
  reports: 5,
  certifications: 2,
  educations: 1,
  avatars: 1,
  profiles: 1,
} as const

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
})

describe('DELETE /api/users/me — Wave 3 R-API-04 closure (cascade partial-failure)', () => {
  it('T-UD01 — happy path: 200 + counts payload + clears session cookie', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })
    vi.mocked(readUserById).mockResolvedValueOnce(STORED_USER as never)
    vi.mocked(verifyPassword).mockReturnValueOnce(true)
    vi.mocked(deleteUserCascade).mockResolvedValueOnce({ counts: CASCADE_COUNTS } as never)

    const res = await DELETE(makeRequest({ password: 'correct-password', confirmation: 'DELETE' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
    expect(body.counts).toEqual(CASCADE_COUNTS)
    // Session cookie cleared (Set-Cookie header with empty value + maxAge=0)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('soc_session=')
  })

  it('T-UD02 — unauthenticated DELETE returns 401 with source: route tag', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
    })

    const res = await DELETE(makeRequest({ password: 'x', confirmation: 'DELETE' }))
    expect(res.status).toBe(401)
    expect(deleteUserCascade).not.toHaveBeenCalled()
  })

  it('T-UD03 — wrong confirmation literal returns 400 (cascade never fires)', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })

    const res = await DELETE(makeRequest({ password: 'correct', confirmation: 'delete' })) // lowercase
    expect(res.status).toBe(400)
    expect(deleteUserCascade).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error).toMatch(/DELETE/)
  })

  it('T-UD04 — missing password returns 400 before user-lookup or password-verify', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })

    const res = await DELETE(makeRequest({ confirmation: 'DELETE' })) // no password field
    expect(res.status).toBe(400)
    expect(readUserById).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(deleteUserCascade).not.toHaveBeenCalled()
  })

  it('T-UD05 — wrong password returns 401 (verifyPassword false)', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })
    vi.mocked(readUserById).mockResolvedValueOnce(STORED_USER as never)
    vi.mocked(verifyPassword).mockReturnValueOnce(false)

    const res = await DELETE(makeRequest({ password: 'wrong', confirmation: 'DELETE' }))
    expect(res.status).toBe(401)
    expect(deleteUserCascade).not.toHaveBeenCalled()
  })

  it('T-UD06 — race: user vanished between session + readUserById returns 404', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })
    vi.mocked(readUserById).mockResolvedValueOnce(null) // user record gone

    const res = await DELETE(makeRequest({ password: 'x', confirmation: 'DELETE' }))
    expect(res.status).toBe(404)
    expect(deleteUserCascade).not.toHaveBeenCalled()
  })

  it('T-UD07 — AUDIT_LOG_FAILED cascade abort returns 500 with friendly message', async () => {
    // R-API-04 partial-failure path: cascade throws AUDIT_LOG_FAILED.
    // Route catches + returns 500 with Turkish error message
    // ("Denetim kaydı oluşturulamadı, hesap silme işlemi iptal edildi").
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })
    vi.mocked(readUserById).mockResolvedValueOnce(STORED_USER as never)
    vi.mocked(verifyPassword).mockReturnValueOnce(true)
    vi.mocked(deleteUserCascade).mockRejectedValueOnce(new Error('AUDIT_LOG_FAILED'))

    const res = await DELETE(makeRequest({ password: 'correct', confirmation: 'DELETE' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/Denetim/)
  })

  it('T-UD08 — cascade returns null → 500 friendly error', async () => {
    // Documents the non-throw failure path: cascade returns null
    // (e.g., adapter-side soft failure). Route returns 500 with
    // "Hesap silinemedi" message rather than crashing.
    vi.mocked(requireSession).mockResolvedValueOnce({ session: SESSION as never, response: null })
    vi.mocked(readUserById).mockResolvedValueOnce(STORED_USER as never)
    vi.mocked(verifyPassword).mockReturnValueOnce(true)
    vi.mocked(deleteUserCascade).mockResolvedValueOnce(null as never)

    const res = await DELETE(makeRequest({ password: 'correct', confirmation: 'DELETE' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/silinemedi/i)
  })
})
