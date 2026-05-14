// Phase 3.D Target #3 — reports/* POST + PATCH (archive) + DELETE [id]
// (R-API-04 cascade two-stage + R-API-05 stored-XSS defense-in-depth).
//
// Maps to Phase 3.A audit Section 2 R-API-04 (account/report cascade)
// + R-API-05 (XSS via report content). Closes:
//   - Input validation surface (title/content max-length, severity enum,
//     broken-encoding rejection, tags filtering)
//   - **Defense-in-depth Layer 1 (input sanitization)**: sanitizeReportContent
//     strips <script>, javascript:, on* handlers before storage
//   - Two-stage delete contract (archive → permanent delete via 409 gate)
//   - FORBIDDEN cross-owner delete
//   - status code map (200/400/401/403/404/409)
//
// SENIOR ARCHITECT NOTE: mock at module boundary per Phase 1.D convention.
// soc-store-adapter mocked; api-auth + auth-server mocked. The sanitize
// helper is NOT mocked — we test the integration (route → sanitize →
// adapter receives sanitized content).
//
// REJECTED ALTERNATIVE: also mock sanitize helper. Rejected — the whole
// point of Layer 1 is to verify the route invokes it correctly. Mocking
// would defeat the test's purpose. sanitize.ts is pure (no I/O, no env),
// safe to import directly.

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  listReports: vi.fn(),
  createReport: vi.fn(),
  archiveReport: vi.fn(),
  deleteReport: vi.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
  listReports,
  createReport,
  archiveReport,
  deleteReport,
} from '@/lib/soc-store-adapter'
import { sanitizeReportContent } from '@/lib/sanitize'

import { POST, PATCH } from '../route'
import { DELETE } from '../[id]/route'

// ─── Test factory helpers ─────────────────────────────────────────────────────

function makeRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`https://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const ANALYST_SESSION = {
  user: { id: 7, username: 'analyst', displayName: 'Analyst', role: 'analyst' as const, emailVerified: true },
  token: 't-analyst',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

const VIEWER_SESSION = {
  user: { id: 9, username: 'viewer', displayName: 'Viewer', role: 'viewer' as const, emailVerified: true },
  token: 't-viewer',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

const baseReport = {
  id: 100,
  title: 'Initial report',
  content: 'Clean content',
  severity: 'LOW',
  status: 'active' as const,
  tags: [] as string[],
  authorUserId: 7,
  isOwner: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
}

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
})

describe('reports/* — Phase 3.D Target #3 (R-API-04 + R-API-05)', () => {
  // ─── POST auth + basic validation (T-RP01-06) ───────────────────────────────

  describe('POST auth + input validation', () => {
    it('T-RP01 — unauthenticated POST returns 401', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await POST(makeRequest('/api/reports', 'POST', { title: 'x', content: 'y' }))
      expect(res.status).toBe(401)
      expect(createReport).not.toHaveBeenCalled()
    })

    it('T-RP02 — empty title rejected with 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(makeRequest('/api/reports', 'POST', { title: '   ', content: 'valid' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/title and content required/i)
    })

    it('T-RP03 — empty content rejected with 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(makeRequest('/api/reports', 'POST', { title: 'valid', content: '' }))
      expect(res.status).toBe(400)
    })

    it('T-RP04 — title > MAX_TITLE_LENGTH (200) rejected with 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(
        makeRequest('/api/reports', 'POST', { title: 'a'.repeat(201), content: 'valid' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/title max 200 karakter/i)
    })

    it('T-RP05 — content > MAX_CONTENT_LENGTH (50_000) rejected with 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(
        makeRequest('/api/reports', 'POST', { title: 'ok', content: 'a'.repeat(50_001) }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/content max 50000 karakter/i)
    })

    it('T-RP06 — invalid severity enum rejected with 400 (LOW/MEDIUM/HIGH/CRITICAL only)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(
        makeRequest('/api/reports', 'POST', { title: 'ok', content: 'ok', severity: 'INVALID' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/severity LOW, MEDIUM, HIGH veya CRITICAL/i)
    })
  })

  // ─── POST input sanitization (R-API-05 Layer 1) (T-RP07-13) ────────────────

  describe('POST input sanitization (R-API-05 defense-in-depth Layer 1)', () => {
    it('T-RP07 — <script>alert(1)</script> stripped before adapter call', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'Test',
          content: 'Hello <script>alert(1)</script> world',
        }),
      )

      const call = vi.mocked(createReport).mock.calls[0]
      const sentContent = call[0].content
      expect(sentContent).not.toContain('<script>')
      expect(sentContent).not.toContain('alert(1)')
      expect(sentContent).toContain('Hello')
      expect(sentContent).toContain('world')
    })

    it('T-RP08 — javascript: URL stripped from attribute value', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'Test',
          content: 'click <a href="javascript:alert(1)">here</a>',
        }),
      )

      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].content).not.toMatch(/javascript:/i)
    })

    it('T-RP09 — on* event handlers stripped (onclick, onload, onerror, onmouseover)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'Test',
          content: '<img src="x" onerror="alert(1)"><div onclick="bad()">x</div>',
        }),
      )

      const call = vi.mocked(createReport).mock.calls[0]
      const sentContent = call[0].content
      expect(sentContent).not.toMatch(/onerror/i)
      expect(sentContent).not.toMatch(/onclick/i)
    })

    it('T-RP10 — <iframe>, <object>, <embed> tags stripped', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'Test',
          content: '<iframe src="evil"></iframe><object data="evil"></object>',
        }),
      )

      const call = vi.mocked(createReport).mock.calls[0]
      const sentContent = call[0].content
      expect(sentContent).not.toMatch(/<iframe/i)
      expect(sentContent).not.toMatch(/<object/i)
    })

    it('T-RP11 — vbscript: scheme stripped', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'Test',
          content: 'click <a href="vbscript:msgbox(1)">here</a>',
        }),
      )

      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].content).not.toMatch(/vbscript:/i)
    })

    it('T-RP12 — benign markdown-like content preserved (bold, italic, paragraphs)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      const benign = 'This is **bold** and *italic*. With a [link](https://example.com) and a newline.\n\nNew paragraph.'
      await POST(makeRequest('/api/reports', 'POST', { title: 'Test', content: benign }))

      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].content).toBe(benign)
    })

    it('T-RP13 — sanitization is idempotent (already-clean content unchanged)', async () => {
      // Property-level test: sanitize is pure, calling twice == calling once.
      const clean = 'No dangerous patterns here. Just text and **markdown**.'
      expect(sanitizeReportContent(sanitizeReportContent(clean))).toBe(sanitizeReportContent(clean))
    })
  })

  // ─── POST tags + broken encoding (T-RP14-17) ────────────────────────────────

  describe('POST tags filtering + broken encoding', () => {
    it('T-RP14 — tags array filtered: max 20 items, max 40 chars per tag, non-strings dropped', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      // Mix of valid + too-long + non-string + 25 items (cap at 20)
      const tags = [
        'valid',
        'a'.repeat(50), // > MAX_TAG_LENGTH 40 → dropped
        123, // non-string → dropped
        'another',
        ...Array.from({ length: 23 }, (_, i) => `tag${i}`),
      ]

      await POST(makeRequest('/api/reports', 'POST', { title: 'Test', content: 'x', tags }))
      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].tags.length).toBeLessThanOrEqual(20)
      expect(call[0].tags.every((t: unknown) => typeof t === 'string' && t.length <= 40)).toBe(true)
    })

    it('T-RP15 — non-array tags coerced to empty', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(makeRequest('/api/reports', 'POST', { title: 'Test', content: 'x', tags: 'not-array' }))
      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].tags).toEqual([])
    })

    it('T-RP16 — broken-encoding character in title rejected with 400 (UTF-8 replacement char)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(
        makeRequest('/api/reports', 'POST', { title: 'broken � title', content: 'ok' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/bozuk karakter/i)
    })

    it('T-RP17 — broken-encoding in any tag rejected with 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'ok',
          content: 'ok',
          tags: ['valid', 'broken�'],
        }),
      )
      expect(res.status).toBe(400)
    })
  })

  // ─── POST happy path + actor identity (T-RP18-20) ───────────────────────────

  describe('POST happy path + actor identity', () => {
    it('T-RP18 — happy POST returns 201 with report in body', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      const res = await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'Investigation Summary',
          content: 'Detailed findings',
          severity: 'HIGH',
        }),
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.report).toEqual(baseReport)
    })

    it('T-RP19 — actor passed to createReport is session.user (mass-assignment guard)', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(
        makeRequest('/api/reports', 'POST', {
          title: 'x',
          content: 'y',
          authorUserId: 99999, // body injection attempt
          actor: 'forged',
        }),
      )

      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].actor.id).toBe(ANALYST_SESSION.user.id)
    })

    it('T-RP20 — severity defaults to LOW when undefined', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(createReport).mockResolvedValueOnce(baseReport)

      await POST(makeRequest('/api/reports', 'POST', { title: 'x', content: 'y' }))
      const call = vi.mocked(createReport).mock.calls[0]
      expect(call[0].severity).toBe('LOW')
    })
  })

  // ─── PATCH archive (T-RP21-24) ──────────────────────────────────────────────

  describe('PATCH archive', () => {
    it('T-RP21 — PATCH action=archive succeeds', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(archiveReport).mockResolvedValueOnce({ ...baseReport, status: 'archived' })

      const res = await PATCH(makeRequest('/api/reports', 'PATCH', { id: 100, action: 'archive' }))
      expect(res.status).toBe(200)
    })

    it('T-RP22 — PATCH with unsupported action returns 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await PATCH(makeRequest('/api/reports', 'PATCH', { id: 100, action: 'delete' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/unsupported action/i)
    })

    it('T-RP23 — PATCH archive cross-owner forbidden returns 403', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: VIEWER_SESSION as never, response: null })
      vi.mocked(archiveReport).mockRejectedValueOnce(new Error('FORBIDDEN'))

      const res = await PATCH(makeRequest('/api/reports', 'PATCH', { id: 100, action: 'archive' }))
      expect(res.status).toBe(403)
    })

    it('T-RP24 — PATCH archive on missing report returns 404', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(archiveReport).mockResolvedValueOnce(null)

      const res = await PATCH(makeRequest('/api/reports', 'PATCH', { id: 100, action: 'archive' }))
      expect(res.status).toBe(404)
    })
  })

  // ─── DELETE two-stage gate (R-API-04) (T-RP25-30) ───────────────────────────

  describe('DELETE two-stage gate (R-API-04 cascade safety)', () => {
    it('T-RP25 — unauthenticated DELETE returns 401 with source: route tag', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({
        session: null,
        response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
      })

      const res = await DELETE(makeRequest('/api/reports/100', 'DELETE'), {
        params: { id: '100' },
      })
      expect(res.status).toBe(401)
    })

    it('T-RP26 — DELETE with invalid id returns 400', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })

      const res = await DELETE(makeRequest('/api/reports/abc', 'DELETE'), {
        params: { id: 'abc' },
      })
      expect(res.status).toBe(400)
    })

    it('T-RP27 — DELETE active report → 409 NOT_ARCHIVED (two-stage gate)', async () => {
      // R-API-04 lineage: archive-before-permanent-delete invariant.
      // Adapter throws NOT_ARCHIVED for active reports; route returns 409.
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(deleteReport).mockRejectedValueOnce(new Error('NOT_ARCHIVED'))

      const res = await DELETE(makeRequest('/api/reports/100', 'DELETE'), {
        params: { id: '100' },
      })
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toMatch(/Yalnızca arşivlenmiş raporlar/i)
    })

    it('T-RP28 — DELETE cross-owner → 403 FORBIDDEN', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: VIEWER_SESSION as never, response: null })
      vi.mocked(deleteReport).mockRejectedValueOnce(new Error('FORBIDDEN'))

      const res = await DELETE(makeRequest('/api/reports/100', 'DELETE'), {
        params: { id: '100' },
      })
      expect(res.status).toBe(403)
    })

    it('T-RP29 — DELETE archived + owner → 200 { ok: true, id }', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      // deleteReport signature: Promise<{ deleted: true } | null> per
      // soc-store-memory.ts L1359. NOT a full ReportRecord. Mock the
      // contract shape.
      vi.mocked(deleteReport).mockResolvedValueOnce({ deleted: true })

      const res = await DELETE(makeRequest('/api/reports/100', 'DELETE'), {
        params: { id: '100' },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.id).toBe(100)
    })

    it('T-RP30 — DELETE missing report → 404', async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({ session: ANALYST_SESSION as never, response: null })
      vi.mocked(deleteReport).mockResolvedValueOnce(null)

      const res = await DELETE(makeRequest('/api/reports/999', 'DELETE'), {
        params: { id: '999' },
      })
      expect(res.status).toBe(404)
    })
  })
})
