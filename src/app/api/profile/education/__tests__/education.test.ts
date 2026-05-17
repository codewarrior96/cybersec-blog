// R-API-14 closure (Wave 5C): education PATCH ?action=archive +
// two-stage DELETE tests. Mirrors the certifications T-CA01-04 suite
// — education is the parallel feature surface with the same archive
// lifecycle contract.
//
// SENIOR ARCHITECT NOTE: mocks at module boundary per project
// convention. soc-store-adapter is mocked (archive + delete + update
// + getPortfolioProfile); api-auth + auth-server are mocked. The
// portfolio-validation helpers are mocked to neutralize input
// validation noise — we're testing the route's archive/delete
// orchestration, not validation regressions (those are owned by
// portfolio-validation's own test surface).
//
// REJECTED ALTERNATIVE: extend the existing certifications test
// file. Rejected — different route, different module imports, and
// audit traceability is cleaner with one test file per
// feature-surface (cert vs. edu).

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  getPortfolioProfile: vi.fn(),
  updatePortfolioEducation: vi.fn(),
  deletePortfolioEducation: vi.fn(),
  archivePortfolioEducation: vi.fn(),
}))
vi.mock('@/lib/portfolio-validation', () => ({
  parseEducationInput: vi.fn(),
  validateEducationInput: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
  archivePortfolioEducation,
  deletePortfolioEducation,
  getPortfolioProfile,
  updatePortfolioEducation,
} from '@/lib/soc-store-adapter'

import { PATCH, DELETE } from '../[id]/route'

function makeRequest(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(`https://localhost${url}`, init as ConstructorParameters<typeof NextRequest>[1])
}

const OWNER_SESSION = {
  user: { id: 1, username: 'owner', role: 'viewer' as const, emailVerified: true },
  token: 't-owner',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

// Full PortfolioEducationRecord shape (src/lib/portfolio-profile.ts L38-51).
// Add `archivedAt` per the Wave 5C schema extension.
const ownerEducation = {
  id: 100,
  userId: 1,
  institution: 'Test University',
  program: 'Computer Science',
  degree: 'BSc',
  startDate: '2020-09-01',
  endDate: '2024-06-30',
  status: 'completed' as const,
  description: '',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null as string | null,
}

// Profile shape passed to the PATCH handler's pre-existence lookup.
function profileWithEducation(eduOverride?: Partial<typeof ownerEducation>) {
  return {
    user: OWNER_SESSION.user,
    profile: {
      headline: 'H',
      bio: '',
      location: '',
      socialLinks: {},
      specialties: [],
      tools: [],
      avatarPath: null,
      avatarName: null,
      avatarMimeType: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    certifications: [],
    education: [{ ...ownerEducation, ...eduOverride }],
  }
}

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
})

describe('education [id] — R-API-14 archive lifecycle (T-EA01-04, Wave 5C)', () => {
  // ─── T-EA01: archive happy path ────────────────────────────────────────────

  it('T-EA01 — PATCH ?action=archive sets archivedAt and returns 200', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
    vi.mocked(getPortfolioProfile).mockResolvedValueOnce(profileWithEducation() as never)

    const archivedAt = '2026-05-16T12:00:00.000Z'
    vi.mocked(archivePortfolioEducation).mockResolvedValueOnce({
      ...ownerEducation,
      archivedAt,
      updatedAt: archivedAt,
    })

    const res = await PATCH(
      makeRequest('/api/profile/education/100?action=archive', { method: 'PATCH' }),
      { params: { id: '100' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.education.archivedAt).toBe(archivedAt)
    // Standard-update adapter was NOT invoked
    expect(updatePortfolioEducation).not.toHaveBeenCalled()
    // Archive adapter was called once with the expected args
    expect(archivePortfolioEducation).toHaveBeenCalledWith(
      100,
      OWNER_SESSION.user.id,
      OWNER_SESSION.user,
      expect.any(Object),
    )
  })

  // ─── T-EA02: DELETE on non-archived edu returns 409 ────────────────────────

  it('T-EA02 — DELETE on non-archived education returns 409 NOT_ARCHIVED', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
    vi.mocked(deletePortfolioEducation).mockRejectedValueOnce(new Error('NOT_ARCHIVED'))

    const res = await DELETE(
      makeRequest('/api/profile/education/100', { method: 'DELETE' }),
      { params: { id: '100' } },
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/once arsivlenmeli/)
  })

  // ─── T-EA03: DELETE on archived edu returns 200 ────────────────────────────

  it('T-EA03 — DELETE on archived education succeeds (200)', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
    const archivedEdu = {
      ...ownerEducation,
      archivedAt: '2026-05-16T12:00:00.000Z',
    }
    vi.mocked(deletePortfolioEducation).mockResolvedValueOnce(archivedEdu)

    const res = await DELETE(
      makeRequest('/api/profile/education/100', { method: 'DELETE' }),
      { params: { id: '100' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.education.id).toBe(100)
  })

  // ─── T-EA04: archive on non-existent edu returns 404 ───────────────────────

  it('T-EA04 — PATCH ?action=archive on non-existent education returns 404', async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
    // pre-existence lookup returns a profile WITHOUT this id → 404
    vi.mocked(getPortfolioProfile).mockResolvedValueOnce({
      user: OWNER_SESSION.user,
      profile: {
        headline: 'H',
        bio: '',
        location: '',
        website: '',
        specialties: [],
        tools: [],
        avatarPath: null,
        avatarName: null,
        avatarMimeType: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      certifications: [],
      education: [],
    } as never)

    const res = await PATCH(
      makeRequest('/api/profile/education/999?action=archive', { method: 'PATCH' }),
      { params: { id: '999' } },
    )

    expect(res.status).toBe(404)
    // Archive adapter never invoked (the pre-existence check guards
    // against orphan calls)
    expect(archivePortfolioEducation).not.toHaveBeenCalled()
  })
})
