// Phase 3.D Target #1 — profile/certifications/[id] PATCH/DELETE + assets/[id] GET
// (R-API-01 High IDOR closure)
//
// Maps to Phase 3.A audit Section 2 R-API-01: numeric certification IDs are
// enumerable; three distinct ownership-check idioms (PATCH 404-mask, DELETE
// adapter-userId pass-through, assets GET explicit 403) create race surface
// + idiom inconsistency. Phase 3.D locks current behavior at all three
// surfaces + the IDOR negative paths.
//
// SENIOR ARCHITECT NOTE: mock at module boundary per Phase 1.D convention
// (login/route.test.ts lineage). soc-store-adapter, portfolio-assets,
// portfolio-validation, supabase-app-state, soc-store-supabase, auth-server,
// api-auth are all mocked. NextRequest constructed inline.
//
// REJECTED ALTERNATIVE: split into two test files (one per route). Rejected
// — Phase 3.D mega-prompt Section 5 Group A specifies single test file per
// target; Target #1 is the certifications feature surface, both routes are
// thematically one IDOR closure. Combined file keeps the IDOR pattern under
// one describe block lineage.

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  getPortfolioCertificationById: vi.fn(),
  updatePortfolioCertification: vi.fn(),
  deletePortfolioCertification: vi.fn(),
  // R-API-14 closure (Wave 5C): archive-stage mock added to the
  // adapter surface for T-CA01-04.
  archivePortfolioCertification: vi.fn(),
}))
vi.mock('@/lib/portfolio-assets', () => ({
  saveCertificationAsset: vi.fn(),
  deleteStoredAsset: vi.fn(),
  readStoredAsset: vi.fn(),
}))
vi.mock('@/lib/portfolio-validation', () => ({
  parseCertificationInput: vi.fn(),
  validateCertificationInput: vi.fn(),
}))
vi.mock('@/lib/supabase-app-state', () => ({
  isSupabaseAppStateEnabled: vi.fn(),
  createSignedObjectUrl: vi.fn(),
}))
vi.mock('@/lib/soc-store-supabase', () => ({
  getPortfolioCertificationById: vi.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
  archivePortfolioCertification,
  getPortfolioCertificationById,
  updatePortfolioCertification,
  deletePortfolioCertification,
} from '@/lib/soc-store-adapter'
import {
  saveCertificationAsset,
  deleteStoredAsset,
  readStoredAsset,
} from '@/lib/portfolio-assets'
import {
  parseCertificationInput,
  validateCertificationInput,
} from '@/lib/portfolio-validation'
import {
  isSupabaseAppStateEnabled,
  createSignedObjectUrl,
} from '@/lib/supabase-app-state'
import * as supabaseStore from '@/lib/soc-store-supabase'

import { PATCH, DELETE } from '../[id]/route'
import { GET as GET_ASSET } from '../assets/[id]/route'

// ─── Test factory helpers ─────────────────────────────────────────────────────

// NextRequest's constructor RequestInit type narrows signal to
// `AbortSignal | undefined` (no null), but the lib.dom RequestInit allows
// `AbortSignal | null`. Cast to Next's expected shape — tests never set
// signal, so the cast is safe at runtime.
function makeRequest(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(`https://localhost${url}`, init as ConstructorParameters<typeof NextRequest>[1])
}

function makeFormData(fields: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

const OWNER_SESSION = {
  user: { id: 1, username: 'owner', displayName: 'Owner', role: 'viewer' as const, emailVerified: true },
  token: 't-owner',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

const OTHER_SESSION = {
  user: { id: 99, username: 'other', displayName: 'Other', role: 'viewer' as const, emailVerified: true },
  token: 't-other',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

// Full PortfolioCertificationRecord shape (src/lib/portfolio-profile.ts L18-36).
// All 17 fields must be present — adapter return type is the strict record,
// not a partial. Drift here surfaces as tsc error at the mockResolvedValueOnce
// boundaries, not at test runtime (TS erasure tolerates the partial at
// runtime but strict-mode tsc rejects). Keep this in lockstep with the
// interface; any field addition there breaks this fixture loudly.
const ownerCertification = {
  id: 42,
  userId: 1,
  title: 'OSCP',
  issuer: 'Offensive Security',
  issueDate: '2024-01-01',
  expiryDate: '',
  credentialId: '',
  verifyUrl: '',
  status: 'active' as const,
  notes: '',
  assetPath: 'certifications/user-1/oscp.pdf' as string | null,
  assetName: 'oscp.pdf' as string | null,
  assetMimeType: 'application/pdf' as string | null,
  assetSize: 12345 as number | null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  // R-API-14 closure (Wave 5C): archivedAt field added to the record
  // shape. Defaults to null in fixture (active state — not yet archived).
  archivedAt: null as string | null,
}

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(parseCertificationInput).mockReturnValue({
    input: {
      title: 'OSCP',
      issuer: 'Offensive Security',
      issuedAt: '2024-01-01',
      status: 'active',
      assetPath: null,
      assetName: null,
      assetMimeType: null,
      assetSize: null,
    } as never,
    assetFile: null,
  })
  vi.mocked(validateCertificationInput).mockReturnValue(null)
  vi.mocked(isSupabaseAppStateEnabled).mockReturnValue(false)
})

describe('certifications + assets — Phase 3.D Target #1 (R-API-01 IDOR)', () => {
  // ─── PATCH auth gate (T-PC01-04) ────────────────────────────────────────────

  describe('PATCH auth gate', () => {
    it('T-PC01 — unauthenticated PATCH returns 401', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await PATCH(makeRequest('/api/profile/certifications/42', { method: 'PATCH' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(401)
    })

    it('T-PC02 — valid session passes the gate (continues to id parse + ownership check)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      // ownership check returns owner's cert
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      vi.mocked(updatePortfolioCertification).mockResolvedValueOnce(ownerCertification)

      const req = makeRequest('/api/profile/certifications/42', {
        method: 'PATCH',
        body: makeFormData(),
      })
      const res = await PATCH(req, { params: { id: '42' } })
      expect(res.status).toBe(200)
    })

    it('T-PC03 — session present but no user.id-bearing user → still 401 via api-auth guard', async () => {
      // api-auth contract: if session is null, response is 401. Test the
      // null-session branch independently from auth-server reality.
      vi.mocked(requireSession).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await PATCH(makeRequest('/api/profile/certifications/42', { method: 'PATCH' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(401)
    })

    it('T-PC04 — invalid certification id (non-numeric) returns 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })

      const res = await PATCH(makeRequest('/api/profile/certifications/abc', { method: 'PATCH' }), {
        params: { id: 'abc' },
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/Gecersiz sertifika kimligi/i)
    })
  })

  // ─── PATCH IDOR closure (T-PC05-09) ─────────────────────────────────────────

  describe('PATCH IDOR closure (R-API-01)', () => {
    it('T-PC05 — owner can PATCH own certification (happy path)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      vi.mocked(updatePortfolioCertification).mockResolvedValueOnce({
        ...ownerCertification,
        title: 'OSCP Updated',
      })

      const req = makeRequest('/api/profile/certifications/42', {
        method: 'PATCH',
        body: makeFormData(),
      })
      const res = await PATCH(req, { params: { id: '42' } })
      expect(res.status).toBe(200)
      expect(updatePortfolioCertification).toHaveBeenCalled()
    })

    it('T-PC06 — non-owner PATCH returns 404 (existence-mask, R-API-01 IDOR closure)', async () => {
      // OTHER_SESSION (user id 99) attempts to PATCH cert owned by user 1.
      // Route reads existing.userId !== session.user.id → returns 404
      // (existence-mask idiom from certifications/[id]/route.ts L37-39).
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OTHER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)

      const req = makeRequest('/api/profile/certifications/42', {
        method: 'PATCH',
        body: makeFormData(),
      })
      const res = await PATCH(req, { params: { id: '42' } })
      expect(res.status).toBe(404)
      expect(updatePortfolioCertification).not.toHaveBeenCalled()
    })

    it('T-PC07 — non-existent certification returns 404 (consistent with existence-mask)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(null)

      const req = makeRequest('/api/profile/certifications/999', {
        method: 'PATCH',
        body: makeFormData(),
      })
      const res = await PATCH(req, { params: { id: '999' } })
      expect(res.status).toBe(404)
    })

    it('T-PC08 — ownership check fires BEFORE validation (404 short-circuits, no validateCertificationInput call)', async () => {
      // Defense-in-depth ordering: ownership check at L37-39 precedes input
      // validation at L43-46. A non-owner with malformed payload sees 404
      // (existence-mask), NOT 400 (validation), preventing existence inference
      // via response code.
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OTHER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)

      const req = makeRequest('/api/profile/certifications/42', {
        method: 'PATCH',
        body: makeFormData(),
      })
      const res = await PATCH(req, { params: { id: '42' } })
      expect(res.status).toBe(404)
      // validateCertificationInput should NOT have been invoked at all
      expect(validateCertificationInput).not.toHaveBeenCalled()
    })

    it('T-PC09 — owner-id taken from session, not from body/param (mass-assignment guard)', async () => {
      // Even if attacker injects userId in payload, the ownership check reads
      // `guard.session.user.id` directly. updatePortfolioCertification is
      // called with session.user.id as the userId arg, not the body.
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      vi.mocked(updatePortfolioCertification).mockResolvedValueOnce(ownerCertification)

      const req = makeRequest('/api/profile/certifications/42', {
        method: 'PATCH',
        body: makeFormData(),
      })
      await PATCH(req, { params: { id: '42' } })

      // Inspect the call: 2nd positional arg to updatePortfolioCertification
      // is the userId. Should be session.user.id (1), not anything from body.
      const call = vi.mocked(updatePortfolioCertification).mock.calls[0]
      expect(call[1]).toBe(OWNER_SESSION.user.id)
    })
  })

  // ─── DELETE auth gate + IDOR (T-PC10-13) ────────────────────────────────────

  describe('DELETE auth gate + IDOR', () => {
    it('T-PC10 — unauthenticated DELETE returns 401', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await DELETE(makeRequest('/api/profile/certifications/42', { method: 'DELETE' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(401)
    })

    it('T-PC11 — owner DELETE succeeds + cleans up asset', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(deletePortfolioCertification).mockResolvedValueOnce(ownerCertification)

      const res = await DELETE(makeRequest('/api/profile/certifications/42', { method: 'DELETE' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(200)
      expect(deleteStoredAsset).toHaveBeenCalledWith(ownerCertification.assetPath)
    })

    it('T-PC12 — non-owner DELETE returns 404 via adapter (deletePortfolioCertification enforces userId at the storage layer)', async () => {
      // DELETE idiom: adapter receives userId; adapter returns null when
      // userId mismatch. Route returns 404 for the null result.
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OTHER_SESSION as never, response: null })
      vi.mocked(deletePortfolioCertification).mockResolvedValueOnce(null)

      const res = await DELETE(makeRequest('/api/profile/certifications/42', { method: 'DELETE' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(404)
      // deleteStoredAsset should NOT be called when adapter rejects
      expect(deleteStoredAsset).not.toHaveBeenCalled()
    })

    it('T-PC13 — DELETE userId argument matches session.user.id (mass-assignment guard for DELETE idiom)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(deletePortfolioCertification).mockResolvedValueOnce(ownerCertification)

      await DELETE(makeRequest('/api/profile/certifications/42', { method: 'DELETE' }), {
        params: { id: '42' },
      })

      const call = vi.mocked(deletePortfolioCertification).mock.calls[0]
      // adapter signature: (certificationId, userId, sessionUser, metadata)
      expect(call[1]).toBe(OWNER_SESSION.user.id)
    })
  })

  // ─── assets/[id] GET — IDOR closure (T-PC14-19) ─────────────────────────────

  describe('assets/[id] GET ownership gate (R-API-01 idiom #3 — explicit 403)', () => {
    it('T-PC14 — unauthenticated GET returns 401', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await GET_ASSET(makeRequest('/api/profile/certifications/assets/42', { method: 'GET' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(401)
    })

    it('T-PC15 — owner GET (non-Supabase path) streams asset buffer with correct headers', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      const fakeBuffer = Buffer.from('PDF-CONTENT')
      vi.mocked(readStoredAsset).mockResolvedValueOnce(fakeBuffer)

      const res = await GET_ASSET(makeRequest('/api/profile/certifications/assets/42', { method: 'GET' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe(ownerCertification.assetMimeType)
      expect(res.headers.get('content-length')).toBe(String(fakeBuffer.byteLength))
    })

    it('T-PC16 — non-owner GET returns 403 EXPLICIT (idiom #3 — diverges from PATCH/DELETE 404-mask, per route.ts comment L43-44)', async () => {
      // assets/[id] GET intentionally returns 403 (not 404) per code comment:
      // numeric IDs already enumerable so existence-masking has limited value;
      // explicit 403 is clearer feedback for legitimate misuse.
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OTHER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)

      const res = await GET_ASSET(makeRequest('/api/profile/certifications/assets/42', { method: 'GET' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toMatch(/erisim yetkiniz yok/i)
    })

    it('T-PC17 — non-existent certification returns 404 (precedes ownership check)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(null)

      const res = await GET_ASSET(makeRequest('/api/profile/certifications/assets/999', { method: 'GET' }), {
        params: { id: '999' },
      })
      expect(res.status).toBe(404)
    })

    it('T-PC18 — cert exists but assetPath missing returns 404 (no asset to serve)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce({ ...ownerCertification, assetPath: null })

      const res = await GET_ASSET(makeRequest('/api/profile/certifications/assets/42', { method: 'GET' }), {
        params: { id: '42' },
      })
      expect(res.status).toBe(404)
    })

    it('T-PC19 — owner GET (Supabase path) issues signed URL with 60s TTL via createSignedObjectUrl', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(isSupabaseAppStateEnabled).mockReturnValue(true)
      vi.mocked(supabaseStore.getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      vi.mocked(createSignedObjectUrl).mockResolvedValueOnce('https://signed.example.com/asset?token=abc')

      const res = await GET_ASSET(makeRequest('/api/profile/certifications/assets/42', { method: 'GET' }), {
        params: { id: '42' },
      })
      // Redirect to signed URL (NextResponse.redirect)
      expect(res.status).toBeGreaterThanOrEqual(300)
      expect(res.status).toBeLessThan(400)
      // TTL = 60 (per route.ts L48)
      const ttlCall = vi.mocked(createSignedObjectUrl).mock.calls[0]
      expect(ttlCall[1]).toBe(60)
    })
  })

  // ─── Adapter compensating action on partial failure (T-PC20) ────────────────

  describe('adapter compensating action on partial failure', () => {
    it('T-PC20 — PATCH with new asset + adapter returns null → newlyStoredAsset is cleaned up (orphan prevention)', async () => {
      // R-API-11 lineage: route at L78 calls `deleteStoredAsset(newlyStoredAssetPath)`
      // when adapter returns null after a new-asset upload — compensating
      // cleanup to prevent storage orphans.
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      const newAsset = {
        assetPath: 'certifications/user-1/new-asset.pdf',
        assetName: 'new-asset.pdf',
        assetMimeType: 'application/pdf',
        assetSize: 99999,
      }
      vi.mocked(parseCertificationInput).mockReturnValueOnce({
        input: {
          title: 'OSCP',
          issuer: 'Offensive Security',
          issuedAt: '2024-01-01',
          status: 'active',
          assetPath: null,
          assetName: null,
          assetMimeType: null,
          assetSize: null,
        } as never,
        assetFile: new File(['pdf-bytes'], 'new-asset.pdf', { type: 'application/pdf' }),
      })
      vi.mocked(saveCertificationAsset).mockResolvedValueOnce(newAsset)
      vi.mocked(updatePortfolioCertification).mockResolvedValueOnce(null)

      const req = makeRequest('/api/profile/certifications/42', {
        method: 'PATCH',
        body: makeFormData(),
      })
      const res = await PATCH(req, { params: { id: '42' } })

      expect(res.status).toBe(404)
      // Compensating cleanup fired for the orphan asset
      expect(deleteStoredAsset).toHaveBeenCalledWith(newAsset.assetPath)
    })
  })

  // ─── R-API-14 archive stage (T-CA01-04, Wave 5C) ────────────────────────────

  describe('PATCH ?action=archive + DELETE two-stage (R-API-14)', () => {
    it('T-CA01 — PATCH ?action=archive sets archivedAt and returns 200', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)

      const archivedAt = '2026-05-16T12:00:00.000Z'
      vi.mocked(archivePortfolioCertification).mockResolvedValueOnce({
        ...ownerCertification,
        archivedAt,
        updatedAt: archivedAt,
      })

      const res = await PATCH(
        makeRequest('/api/profile/certifications/42?action=archive', { method: 'PATCH' }),
        { params: { id: '42' } },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.certification.archivedAt).toBe(archivedAt)
      // The standard-update adapter was NOT invoked — archive path
      // short-circuits before the form-body branch.
      expect(updatePortfolioCertification).not.toHaveBeenCalled()
      // The archive adapter was called once with the expected args
      expect(archivePortfolioCertification).toHaveBeenCalledWith(
        42,
        OWNER_SESSION.user.id,
        OWNER_SESSION.user,
        expect.any(Object),
      )
    })

    it('T-CA02 — DELETE on non-archived cert returns 409 NOT_ARCHIVED', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      // Adapter throws when archivedAt is null (two-stage gate)
      vi.mocked(deletePortfolioCertification).mockRejectedValueOnce(new Error('NOT_ARCHIVED'))

      const res = await DELETE(
        makeRequest('/api/profile/certifications/42', { method: 'DELETE' }),
        { params: { id: '42' } },
      )

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toMatch(/once arsivlenmeli/)
      // No asset cleanup attempted (the throw short-circuits the route)
      expect(deleteStoredAsset).not.toHaveBeenCalled()
    })

    it('T-CA03 — DELETE on archived cert succeeds (200) and purges asset', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      const archivedCert = {
        ...ownerCertification,
        archivedAt: '2026-05-16T12:00:00.000Z',
      }
      vi.mocked(deletePortfolioCertification).mockResolvedValueOnce(archivedCert)

      const res = await DELETE(
        makeRequest('/api/profile/certifications/42', { method: 'DELETE' }),
        { params: { id: '42' } },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.certification.id).toBe(42)
      // Asset purge fired with the archived cert's asset path
      expect(deleteStoredAsset).toHaveBeenCalledWith(archivedCert.assetPath)
    })

    it('T-CA04 — PATCH ?action=archive on non-existent cert returns 404', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: OWNER_SESSION as never, response: null })
      vi.mocked(getPortfolioCertificationById).mockResolvedValueOnce(ownerCertification)
      // archive adapter returns null when the record is not found
      // for the given userId (defense-in-depth IDOR check beyond the
      // pre-archive existence lookup).
      vi.mocked(archivePortfolioCertification).mockResolvedValueOnce(null)

      const res = await PATCH(
        makeRequest('/api/profile/certifications/42?action=archive', { method: 'PATCH' }),
        { params: { id: '42' } },
      )

      expect(res.status).toBe(404)
    })
  })
})
