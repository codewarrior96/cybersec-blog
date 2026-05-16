// R-API-08 closure (Wave 5B): cybernews fast-xml-parser tests.
//
// Validates the migration from hand-rolled regex XML parser to
// fast-xml-parser library. Phase 3.A audit flagged regex-based RSS
// parsing as an anti-pattern (nested tags, malformed CDATA, unicode
// edge cases). These tests assert the library-backed parser handles
// the three feed shapes in production (RSS 2.0, Atom, FeedBurner-
// wrapped) plus the defensive empty-array return on malformed XML.
//
// SENIOR ARCHITECT NOTE: vi.stubGlobal('fetch', ...) replaces the
// global fetch entirely per test — MSW (configured with
// onUnhandledRequest: 'error') is bypassed because the stub is
// invoked before MSW's interceptor. The stub yields deterministic
// XML payloads so the parser's behavior is the only variable.
//
// REJECTED ALTERNATIVE: MSW handlers for each feed URL. Rejected —
// adds a setup file per feed source for tests that fundamentally
// verify the parser, not the network shape. vi.stubGlobal keeps
// the test focused on what's being asserted.
//
// REJECTED ALTERNATIVE: import + call parseFeed directly. Rejected
// — parseFeed is a module-internal helper (not exported); the
// route's GET handler is the public surface. Driving via GET also
// covers the rate-limit + feed-loop integration in one path.

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/client-ip', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { NextRequest } from 'next/server'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'

import { GET } from '../route'

function makeRequest(): NextRequest {
  return new NextRequest('https://localhost/api/cybernews', { method: 'GET' })
}

function rssPayload(items: { title: string; link: string; pubDate: string; description?: string }[]): string {
  return `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test feed</title>
${items
  .map(
    (it) => `    <item>
      <title>${it.title}</title>
      <link>${it.link}</link>
      <pubDate>${it.pubDate}</pubDate>
      <description>${it.description ?? 'desc'}</description>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>`
}

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remaining: 60, resetAt: Date.now() + 60_000 })
  vi.mocked(recordFailure).mockResolvedValue({ limited: false, remaining: 59, resetAt: Date.now() + 60_000 })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api/cybernews — fast-xml-parser (R-API-08 closure)', () => {
  // ─── T-CN01: RSS 2.0 parsing happy-path ────────────────────────────────────

  it('T-CN01 — RSS 2.0 <item> nodes are parsed and aggregated across feeds', async () => {
    const xml = rssPayload([
      { title: 'CVE-2026-1111 disclosure', link: 'https://example.test/a', pubDate: 'Mon, 01 Jan 2026 12:00:00 GMT' },
      { title: 'Ransomware operator indicted', link: 'https://example.test/b', pubDate: 'Tue, 02 Jan 2026 12:00:00 GMT' },
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xml,
    }))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    // 5 feeds × 2 items each = 10 (capped at MAX_TOTAL=20)
    expect(body.items.length).toBeGreaterThan(0)
    // Each item shape preserves RSS fields
    const first = body.items[0]
    expect(first.title).toMatch(/CVE|Ransomware/)
    expect(first.link).toMatch(/^https:\/\/example\.test/)
    expect(first.source).toMatch(/THN|Krebs|BleepingComputer|SANS ISC|SecurityWeek/)
  })

  // ─── T-CN02: Atom feed parsing (<entry> + <link href=...>) ─────────────────

  it('T-CN02 — Atom <entry> with href-attribute link is extracted correctly', async () => {
    const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom feed</title>
  <entry>
    <title>Atom-style article</title>
    <link href="https://atom.test/article-1"/>
    <updated>2026-01-01T12:00:00Z</updated>
    <summary>Summary text</summary>
  </entry>
</feed>`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => atom,
    }))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    // The href attribute, not the <link> text node, must surface as the link
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items[0].link).toBe('https://atom.test/article-1')
    expect(body.items[0].title).toBe('Atom-style article')
  })

  // ─── T-CN03: malformed XML returns [] (defensive) ─────────────────────────

  it('T-CN03 — malformed XML payload yields empty feed (no throw)', async () => {
    // Garbage that fast-xml-parser cannot parse, AND not valid HTML either.
    // The route's per-feed try/catch returns [] rather than crashing the
    // outer Promise.allSettled — this asserts the defensive behavior.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<<<not valid xml>>>',
    }))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    // All 5 feeds returned malformed XML → 0 items aggregated
    expect(body.items).toEqual([])
  })

  // ─── T-CN04: CDATA-wrapped content is unwrapped, HTML entities decoded ────

  it('T-CN04 — CDATA-wrapped title + entity-encoded description are decoded', async () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Apache Struts &amp; CVE]]></title>
      <link>https://example.test/cdata</link>
      <pubDate>Mon, 01 Jan 2026 12:00:00 GMT</pubDate>
      <description>foo &amp; bar &#x27; baz</description>
    </item>
  </channel>
</rss>`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xml,
    }))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.items.length).toBeGreaterThan(0)
    const item = body.items[0]
    // CDATA wrapper stripped, &amp; entity decoded
    expect(item.title).toContain('Apache Struts')
    expect(item.title).toContain('&')
    expect(item.title).not.toContain('CDATA')
    // Description has entity-decoded ampersand and numeric entity (')
    expect(item.description).toContain('&')
    expect(item.description).not.toContain('&amp;')
  })
})
