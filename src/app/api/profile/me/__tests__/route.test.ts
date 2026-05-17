// Wave 2B — R-API-13 closure regression tests for /api/profile/me PUT
// (defense-in-depth Layer 1 — 6th instance of the pattern catalog).
//
// Phase 3.A R-API-13: profile bio/headline render path may interpolate
// HTML in future UI surfaces. Layer 1 strips XSS vectors at PUT time.
// Layer 2 (React/MDX default safe-text) is the existing render-side
// protection. Tests verify the strip contract + benign preservation.
//
// SENIOR ARCHITECT NOTE: tests use real `sanitizeReportContent` (not
// mocked) — the integration is what we're testing. Adapter is mocked at
// module boundary per Phase 1.D / Phase 3.D convention.
//
// REJECTED ALTERNATIVE: mock sanitize.ts. Rejected — the whole point of
// Layer 1 is to verify the route invokes it correctly. Mocking would
// defeat the integration assertion.

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({
  getRequestMetadata: vi.fn(),
}))
vi.mock('@/lib/soc-store-adapter', () => ({
  getPortfolioProfile: vi.fn(),
  updatePortfolioProfile: vi.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { updatePortfolioProfile } from '@/lib/soc-store-adapter'

import { PUT } from '../route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('https://localhost/api/profile/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const SESSION = {
  user: { id: 7, username: 'operator1', role: 'analyst' as const, emailVerified: true },
  token: 't-op',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

// Stub return value — the adapter is mocked; we only inspect what the
// route passes to it (the sanitized payload), not the persisted result.
const STUB_PROFILE = { user: SESSION.user, profile: {}, certifications: [], education: [] } as never

beforeEach(() => {
  vi.mocked(getRequestMetadata).mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'test' })
  vi.mocked(requireSession).mockResolvedValue({ session: SESSION as never, response: null })
  vi.mocked(updatePortfolioProfile).mockResolvedValue(STUB_PROFILE)
})

describe('/api/profile/me PUT — Wave 2B R-API-13 closure (6th defense-in-depth)', () => {
  it('T-PM01 — clean bio passes through unchanged', async () => {
    const cleanBio = 'Cybersecurity engineer focused on cloud-native SOC tooling.'
    await PUT(makeRequest({ headline: 'Security Engineer', bio: cleanBio }))

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].bio).toBe(cleanBio)
  })

  it('T-PM02 — clean headline passes through unchanged', async () => {
    const cleanHeadline = 'Senior Detection Engineer · SOC Lead'
    await PUT(makeRequest({ headline: cleanHeadline, bio: 'My day-to-day involves threat hunting.' }))

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].headline).toBe(cleanHeadline)
  })

  it('T-PM03 — <script> tag stripped from bio before storage', async () => {
    await PUT(
      makeRequest({
        headline: 'Engineer',
        bio: 'Hello <script>alert(document.cookie)</script> world',
      }),
    )

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].bio).not.toContain('<script>')
    expect(call[1].bio).not.toContain('alert(document.cookie)')
    expect(call[1].bio).toContain('Hello')
    expect(call[1].bio).toContain('world')
  })

  it('T-PM04 — javascript: URL stripped from bio link', async () => {
    await PUT(
      makeRequest({
        headline: 'Engineer',
        bio: 'Visit <a href="javascript:steal()">my site</a> for more',
      }),
    )

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].bio).not.toMatch(/javascript:/i)
  })

  it('T-PM05 — on* event handler attribute stripped from bio', async () => {
    await PUT(
      makeRequest({
        headline: 'Engineer',
        bio: '<img src="x" onerror="alert(1)"><div onclick="bad()">click</div>',
      }),
    )

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].bio).not.toMatch(/onerror/i)
    expect(call[1].bio).not.toMatch(/onclick/i)
  })

  it('T-PM06 — vbscript: + data:text/html URI schemes stripped from bio', async () => {
    await PUT(
      makeRequest({
        headline: 'Engineer',
        bio: 'Try <a href="vbscript:msgbox(1)">a</a> or <a href="data:text/html,<script>x</script>">b</a>',
      }),
    )

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].bio).not.toMatch(/vbscript:/i)
    expect(call[1].bio).not.toMatch(/data:\s*text\/html/i)
  })

  it('T-PM07 — markdown-style formatting preserved (bold, italic, links)', async () => {
    const markdownBio = 'I am **bold** and *italic* with a [link](https://example.com).'
    await PUT(makeRequest({ headline: 'Engineer', bio: markdownBio }))

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    // Markdown syntax not in DANGEROUS_PATTERNS → fully preserved
    expect(call[1].bio).toBe(markdownBio)
  })

  it('T-PM08 — headline sanitized identically to bio (script + javascript:)', async () => {
    await PUT(
      makeRequest({
        headline: 'Senior <script>x()</script> Engineer',
        bio: 'profile bio text here',
      }),
    )

    const call = vi.mocked(updatePortfolioProfile).mock.calls[0]
    expect(call[1].headline).not.toContain('<script>')
    expect(call[1].headline).not.toContain('x()')
    expect(call[1].headline).toContain('Senior')
    expect(call[1].headline).toContain('Engineer')
  })
})
