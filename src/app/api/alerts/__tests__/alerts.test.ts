// Phase 3.D Target #2 — alerts/[id] PATCH (R-API-02 RBAC business-logic) +
// A-13 closure (R-05 TOCTOU concurrent register-call test).
//
// Maps to Phase 3.A audit Section 2 R-API-02: requireRole('analyst') is the
// route-level RBAC gate, but business-logic semantics (claim/resolve/
// assigneeId transitions) live in patchAlert at the adapter layer. Phase 3.D
// asserts the route's pre-adapter contract: input parsing, RBAC dispatch,
// status code map.
//
// A-13 closure (mentor Z.4): single concurrent registerUser race test added
// at the bottom (T-AL-A13). Promise.all on two register calls with same
// email; storage layer's race-guard returns 'Email already exists' for at
// most one path. Exercises soc-store-memory.registerUser directly (not via
// adapter — bypasses dispatcher, isolates race semantics to the storage
// module itself).
//
// SENIOR ARCHITECT NOTE: vi.mock at module boundary mirrors Phase 1.D
// route-test convention. soc-store-adapter mocked for happy-path / error-
// path / not-found-path coverage. requireRole returns { session, response }
// shape per api-auth contract (login route lineage).
//
// REJECTED ALTERNATIVE: full integration test against real Supabase or
// SQLite. Rejected — Phase 3.A Section 6 confirmed Phase 3.D uses adapter-
// boundary vi.mock (Lab Engine + Phase 1.D convention). Real-store
// integration is Phase 5 E2E territory.

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  patchAlert: vi.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { patchAlert } from '@/lib/soc-store-adapter'

import { PATCH } from '../[id]/route'

// ─── Test factory helpers ─────────────────────────────────────────────────────

function makePatchRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`https://localhost/api/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ANALYST_SESSION = {
  user: { id: 7, username: 'analyst1', displayName: 'Analyst One', role: 'analyst' as const, emailVerified: true },
  token: 't-analyst',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

// Full AlertRecord shape (src/lib/soc-store.ts L48-65). All 16 fields must
// be present — the adapter return type is the strict record, not a partial.
// Drift here surfaces as tsc error at the mockResolvedValueOnce boundaries,
// not at runtime (TS erasure tolerates the partial at runtime but strict-
// mode tsc rejects). Keep this in lockstep with the AlertRecord interface.
const baseAlert = {
  id: 42,
  title: 'Suspicious login',
  description: 'Investigation needed',
  status: 'new' as const,
  priority: 'P2' as const,
  sourceEventId: null,
  sourceIp: null,
  sourceCountry: null,
  attackType: null,
  assignee: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  resolvedAt: null as string | null,
  firstResponseAt: null as string | null,
  noteCount: 0,
  ageMinutes: 0,
}

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
})

describe('alerts/[id] PATCH — Phase 3.D Target #2 (R-API-02 RBAC business-logic)', () => {
  // ─── PATCH auth gate (T-AL01-04) ────────────────────────────────────────────

  describe('PATCH auth gate', () => {
    it('T-AL01 — unauthenticated PATCH returns 401 via requireRole short-circuit', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await PATCH(makePatchRequest('42', { status: 'resolved' }), { params: { id: '42' } })
      expect(res.status).toBe(401)
      expect(patchAlert).not.toHaveBeenCalled()
    })

    it('T-AL02 — viewer role (insufficient) returns 403', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Bu islem icin yetkiniz yok.' }, { status: 403 }),
      })

      const res = await PATCH(makePatchRequest('42', { status: 'resolved' }), { params: { id: '42' } })
      expect(res.status).toBe(403)
      expect(patchAlert).not.toHaveBeenCalled()
    })

    it('T-AL03 — analyst role passes the gate (continues to id parse)', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce({ ...baseAlert, status: 'resolved', resolvedAt: '2026-01-02T00:00:00.000Z' })

      const res = await PATCH(makePatchRequest('42', { status: 'resolved' }), { params: { id: '42' } })
      expect(res.status).toBe(200)
    })

    it('T-AL04 — requireRole returned session=null without response → 401 (defensive route-level check)', async () => {
      // api-auth contract: response null + session null is impossible per current
      // implementation, but route at L38-40 has a defensive check. Test it fires.
      vi.mocked(requireRole).mockResolvedValueOnce({ session: null, response: null } as never)

      const res = await PATCH(makePatchRequest('42', { status: 'resolved' }), { params: { id: '42' } })
      expect(res.status).toBe(401)
    })
  })

  // ─── Input validation (T-AL05-09) ───────────────────────────────────────────

  describe('input validation', () => {
    it('T-AL05 — non-numeric alert id returns 400', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await PATCH(makePatchRequest('abc', { status: 'resolved' }), { params: { id: 'abc' } })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/Gecersiz alert id/i)
    })

    it('T-AL06 — negative alert id returns 400', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await PATCH(makePatchRequest('-1', { status: 'resolved' }), { params: { id: '-1' } })
      expect(res.status).toBe(400)
    })

    it('T-AL07 — zero alert id returns 400', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await PATCH(makePatchRequest('0', { status: 'resolved' }), { params: { id: '0' } })
      expect(res.status).toBe(400)
    })

    it('T-AL08 — invalid status value silently ignored (parser returns undefined → no update)', async () => {
      // parseStatus returns undefined for unknown strings; route passes
      // undefined to patchAlert which interprets as "no change". Documents
      // the parser's permissive behavior (no 400 surfaced for unknown
      // enum values on PATCH — only POST validates priority).
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      const res = await PATCH(makePatchRequest('42', { status: 'INVALID' }), { params: { id: '42' } })
      expect(res.status).toBe(200)
      // status arg passed to patchAlert is undefined (parseStatus rejected)
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[1].status).toBeUndefined()
    })

    it('T-AL09 — invalid priority value silently ignored (consistent with status)', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      const res = await PATCH(makePatchRequest('42', { priority: 'P9' }), { params: { id: '42' } })
      expect(res.status).toBe(200)
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[1].priority).toBeUndefined()
    })
  })

  // ─── Business-logic transitions (T-AL10-15) ─────────────────────────────────

  describe('business-logic transitions (R-API-02)', () => {
    it('T-AL10 — claim:true → patchAlert receives claim flag', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce({ ...baseAlert, assignee: ANALYST_SESSION.user })

      const res = await PATCH(makePatchRequest('42', { claim: true }), { params: { id: '42' } })
      expect(res.status).toBe(200)
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[1].claim).toBe(true)
    })

    it('T-AL11 — claim:false → claim flag absent in patch payload', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      const res = await PATCH(makePatchRequest('42', { claim: false }), { params: { id: '42' } })
      expect(res.status).toBe(200)
      const call = vi.mocked(patchAlert).mock.calls[0]
      // Route at L60: `claim = body.claim === true` → false if not exactly true
      expect(call[1].claim).toBe(false)
    })

    it('T-AL12 — resolve:true → patchAlert receives resolve flag (status auto-set inside adapter)', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce({ ...baseAlert, status: 'resolved', resolvedAt: '2026-01-02T00:00:00.000Z' })

      const res = await PATCH(makePatchRequest('42', { resolve: true }), { params: { id: '42' } })
      expect(res.status).toBe(200)
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[1].resolve).toBe(true)
    })

    it('T-AL13 — assigneeId numeric coerced; null preserved; undefined preserved', async () => {
      // Route at L50-57: undefined → undefined, null → null, numeric-finite →
      // Number(), else undefined.
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      await PATCH(makePatchRequest('42', { assigneeId: 5 }), { params: { id: '42' } })
      expect(vi.mocked(patchAlert).mock.calls[0][1].assigneeId).toBe(5)
    })

    it('T-AL14 — assigneeId: null (unassign) preserved', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      await PATCH(makePatchRequest('42', { assigneeId: null }), { params: { id: '42' } })
      expect(vi.mocked(patchAlert).mock.calls[0][1].assigneeId).toBeNull()
    })

    it('T-AL15 — assigneeId: invalid (NaN string) → undefined (no update)', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      await PATCH(makePatchRequest('42', { assigneeId: 'not-a-number' }), { params: { id: '42' } })
      expect(vi.mocked(patchAlert).mock.calls[0][1].assigneeId).toBeUndefined()
    })
  })

  // ─── Status code map + actor identity (T-AL16-20) ───────────────────────────

  describe('status code map + actor identity', () => {
    it('T-AL16 — adapter returns null → 404 (alert not found)', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(null)

      const res = await PATCH(makePatchRequest('999', { status: 'resolved' }), { params: { id: '999' } })
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toMatch(/Alert bulunamadi/i)
    })

    it('T-AL17 — adapter returns alert → 200 with alert in body', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      const updated = { ...baseAlert, status: 'in_progress' as const }
      vi.mocked(patchAlert).mockResolvedValueOnce(updated)

      const res = await PATCH(makePatchRequest('42', { status: 'in_progress' }), { params: { id: '42' } })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.alert).toEqual(updated)
    })

    it('T-AL18 — actor passed to patchAlert is session.user, not body-controllable', async () => {
      // Mass-assignment guard: even if attacker puts actorUserId in body,
      // route reads from `guard.session.user` (L72).
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      await PATCH(makePatchRequest('42', { status: 'resolved', actorUserId: 99999 }), {
        params: { id: '42' },
      })
      // 3rd positional arg to patchAlert is actor SessionUser
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[2].id).toBe(ANALYST_SESSION.user.id)
    })

    it('T-AL19 — note field passed through when string', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      await PATCH(makePatchRequest('42', { note: 'Investigated, false positive' }), { params: { id: '42' } })
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[1].note).toBe('Investigated, false positive')
    })

    it('T-AL20 — non-string note coerced to undefined (defensive parse at L58)', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(patchAlert).mockResolvedValueOnce(baseAlert)

      await PATCH(makePatchRequest('42', { note: 12345 }), { params: { id: '42' } })
      const call = vi.mocked(patchAlert).mock.calls[0]
      expect(call[1].note).toBeUndefined()
    })
  })
})

// ─── A-13 closure: storage adapter race-condition test ──────────────────────

describe('A-13 closure — soc-store-memory registerUser concurrent race (R-05 TOCTOU)', () => {
  it('T-AL-A13 — Promise.all on two concurrent registerUser calls with same username → at most one succeeds (storage race-guard)', async () => {
    // A-13 (pending-amendments.md L91-95): R-05 TOCTOU between
    // readUserByEmailKey and registerUser. The storage layer's race-guard
    // returns 'User already exists' for the loser. Phase 3.D closes A-13
    // via this direct concurrent test against the memory store
    // (bypasses adapter dispatcher; isolates race semantics to the
    // storage module itself).
    //
    // SENIOR ARCHITECT NOTE: this test imports memoryStore directly, NOT
    // via adapter. Adapter routing (Class 1 identity ops → supabase /
    // supabase-postgres / memory) is irrelevant to the race-guard
    // assertion — the race lives in each store implementation. Memory
    // store is the simplest to exercise; same-store-coherence assertion.
    //
    // Phase 2.A Section 8 re-mapped A-13 from "Phase 2 storage suite" to
    // Phase 3 because storage adapter is Phase 3 territory per
    // CLAUDE.md L171.

    // Reset any prior storage state would corrupt this race test.
    // vi.resetModules is heavy — instead use direct memoryStore import +
    // unique username per test run (test isolation via uniqueness).
    const memoryStore = await import('@/lib/soc-store-memory')

    const username = `race-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const passwordHash = 'a'.repeat(32) + ':' + 'b'.repeat(128) // valid HASH_FORMAT_RE shape

    // Two concurrent register calls with the same username.
    const promises = [
      memoryStore.registerUser({
        username,
        displayName: 'Test User',
        role: 'viewer',
        passwordHash,
        metadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
      }),
      memoryStore.registerUser({
        username,
        displayName: 'Test User 2',
        role: 'viewer',
        passwordHash,
        metadata: { ipAddress: '127.0.0.2', userAgent: 'test' },
      }),
    ]

    const results = await Promise.allSettled(promises)
    const succeeded = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    // Storage race-guard contract: at most ONE register succeeds.
    // The other must reject with 'User already exists' (or be a no-op).
    expect(succeeded.length + rejected.length).toBe(2)
    expect(succeeded.length).toBeLessThanOrEqual(1)

    // If one rejected, the rejection message must indicate the race-guard
    // fired ('User already exists' is the storage-layer's contract).
    if (rejected.length > 0) {
      const reason = (rejected[0] as PromiseRejectedResult).reason
      const message = reason instanceof Error ? reason.message : String(reason)
      expect(message).toMatch(/already exists|exists/i)
    }
  })
})
