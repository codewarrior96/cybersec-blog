// R-API-10 + R-API-11 closure (Wave 5B): avatar route tests.
//
// Validates two Wave 5B closures on the avatar surface:
//   - R-API-10: signed-URL TTL tightened from 60s to 15s on GET
//     [userId] path. Phase 3.A audit flagged 60s as too long for a
//     leaked URL (clipboard / screenshot of URL bar).
//   - R-API-11: previous-asset cleanup on POST is best-effort. If
//     the OLD-avatar deletion throws (Supabase Storage outage), the
//     handler logs and returns 200 — the user's new avatar is
//     already committed; the old asset becomes an orphan for a
//     future sweep cycle (Phase 6).
//
// SENIOR ARCHITECT NOTE: mocks at module boundary. supabase-app-state +
// soc-store-supabase + soc-store-adapter + portfolio-assets + api-auth +
// auth-server are all mocked so the test exercises ONLY the route's
// orchestration logic (TTL value passed to createSignedObjectUrl;
// try/catch wrapper around the cleanup call).
//
// REJECTED ALTERNATIVE: real Supabase integration test. Rejected —
// non-deterministic and would require a live test bucket.

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  getPortfolioProfile: vi.fn(),
  updatePortfolioAvatar: vi.fn(),
}))
vi.mock('@/lib/portfolio-assets', () => ({
  saveAvatarAsset: vi.fn(),
  deleteStoredAsset: vi.fn(),
  readStoredAsset: vi.fn(),
}))
vi.mock('@/lib/supabase-app-state', () => ({
  isSupabaseAppStateEnabled: vi.fn(),
  createSignedObjectUrl: vi.fn(),
}))
vi.mock('@/lib/soc-store-supabase', () => ({
  getPortfolioAvatarForUser: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
  getPortfolioProfile,
  updatePortfolioAvatar,
} from '@/lib/soc-store-adapter'
import {
  saveAvatarAsset,
  deleteStoredAsset,
} from '@/lib/portfolio-assets'
import {
  createSignedObjectUrl,
  isSupabaseAppStateEnabled,
} from '@/lib/supabase-app-state'
import { getPortfolioAvatarForUser } from '@/lib/soc-store-supabase'

import { POST } from '../route'
import { GET as GET_BY_USER } from '../[userId]/route'

const OWNER_SESSION = {
  user: { id: 1, username: 'owner', displayName: 'Owner', role: 'viewer' as const, emailVerified: true },
  token: 't-owner',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

function makeUploadRequest(): NextRequest {
  const fd = new FormData()
  // Minimal in-memory PNG bytes (header) so the route's File branch is taken.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  fd.append('avatar', new File([png], 'avatar.png', { type: 'image/png' }))
  // NextRequest expects a Request-compatible body. FormData is acceptable per fetch spec.
  const req = new Request('https://localhost/api/profile/avatar', { method: 'POST', body: fd })
  return new NextRequest(req)
}

function makeGetRequest(): NextRequest {
  return new NextRequest('https://localhost/api/profile/avatar/1', { method: 'GET' })
}

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(requireSession).mockResolvedValue({ session: OWNER_SESSION as never, response: null })
})

describe('api/profile/avatar — R-API-10 + R-API-11 closures', () => {
  // ─── T-AV-TTL: R-API-10 signed-URL TTL is 15s, not 60s ─────────────────────

  it('T-AV-TTL — GET [userId] passes 15s expiry to createSignedObjectUrl (R-API-10)', async () => {
    vi.mocked(isSupabaseAppStateEnabled).mockReturnValue(true)
    vi.mocked(getPortfolioAvatarForUser).mockResolvedValueOnce({
      assetPath: 'avatars/user-1/avatar.png',
      assetName: 'avatar.png',
      assetMimeType: 'image/png',
    })
    vi.mocked(createSignedObjectUrl).mockResolvedValueOnce('https://signed.test/avatar?ttl=15')

    const res = await GET_BY_USER(makeGetRequest(), { params: { userId: '1' } })

    // Assert the TTL value passed to the Supabase helper — this is the
    // R-API-10 closure invariant. Drift back to 60s would fail this test.
    expect(createSignedObjectUrl).toHaveBeenCalledWith('avatars/user-1/avatar.png', 15)
    // Sanity: the route redirected (302) to the signed URL
    expect(res.status).toBe(307)
  })

  // ─── T-AV-ORPHAN01: R-API-11 cleanup failure does NOT propagate ────────────

  it('T-AV-ORPHAN01 — POST returns 200 even when previous-asset cleanup throws (R-API-11)', async () => {
    // User already has an avatar — cleanup of the OLD asset is attempted
    // after the new one is committed. Stage that scenario.
    vi.mocked(getPortfolioProfile).mockResolvedValueOnce({
      profile: {
        userId: 1,
        displayName: 'Owner',
        bio: '',
        role: 'viewer',
        avatarPath: 'avatars/user-1/old-avatar.png',
        avatarName: 'old-avatar.png',
        avatarMimeType: 'image/png',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      certifications: [],
      education: [],
    } as never)
    vi.mocked(saveAvatarAsset).mockResolvedValueOnce({
      assetPath: 'avatars/user-1/new-avatar.png',
      assetName: 'new-avatar.png',
      assetMimeType: 'image/png',
    })
    vi.mocked(updatePortfolioAvatar).mockResolvedValueOnce({
      profile: {
        userId: 1,
        displayName: 'Owner',
        bio: '',
        role: 'viewer',
        avatarPath: 'avatars/user-1/new-avatar.png',
        avatarName: 'new-avatar.png',
        avatarMimeType: 'image/png',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
      certifications: [],
      education: [],
    } as never)

    // OLD-avatar delete throws — simulates Supabase Storage outage /
    // transient network failure. R-API-11 closure says this MUST NOT
    // roll back the new-avatar commit.
    vi.mocked(deleteStoredAsset).mockRejectedValueOnce(
      new Error('supabase storage 503'),
    )

    // Suppress the console.warn so the test output stays clean
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await POST(makeUploadRequest())

    // R-API-11 closure: 200 OK despite cleanup failure
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile).toBeDefined()
    expect(body.profile.profile.avatarPath).toBe('avatars/user-1/new-avatar.png')

    // The warn log was emitted with the expected shape (orphan tracking)
    expect(warnSpy).toHaveBeenCalled()
    const warnCall = warnSpy.mock.calls[0]
    expect(warnCall[0]).toMatch(/previous-asset cleanup failed/)

    warnSpy.mockRestore()
  })

  // ─── T-AV-ORPHAN02: happy path — cleanup proceeds normally ─────────────────

  it('T-AV-ORPHAN02 — POST happy path deletes previous asset and returns 200', async () => {
    vi.mocked(getPortfolioProfile).mockResolvedValueOnce({
      profile: {
        userId: 1,
        displayName: 'Owner',
        bio: '',
        role: 'viewer',
        avatarPath: 'avatars/user-1/old-avatar.png',
        avatarName: 'old-avatar.png',
        avatarMimeType: 'image/png',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      certifications: [],
      education: [],
    } as never)
    vi.mocked(saveAvatarAsset).mockResolvedValueOnce({
      assetPath: 'avatars/user-1/new-avatar.png',
      assetName: 'new-avatar.png',
      assetMimeType: 'image/png',
    })
    vi.mocked(updatePortfolioAvatar).mockResolvedValueOnce({
      profile: {
        userId: 1,
        displayName: 'Owner',
        bio: '',
        role: 'viewer',
        avatarPath: 'avatars/user-1/new-avatar.png',
        avatarName: 'new-avatar.png',
        avatarMimeType: 'image/png',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
      certifications: [],
      education: [],
    } as never)
    vi.mocked(deleteStoredAsset).mockResolvedValueOnce(undefined)

    const res = await POST(makeUploadRequest())
    expect(res.status).toBe(200)

    // Previous asset was deleted exactly once
    expect(deleteStoredAsset).toHaveBeenCalledTimes(1)
    expect(deleteStoredAsset).toHaveBeenCalledWith('avatars/user-1/old-avatar.png')
  })
})
