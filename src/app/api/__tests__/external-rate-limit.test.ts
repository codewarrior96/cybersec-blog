// R-API-09 closure (Wave 5B): external-route rate-limit gate tests.
//
// Validates that the three external API routes (cves, greynoise,
// cybernews) all short-circuit with 429 Too Many Requests + a
// Retry-After header when the per-IP bucket is exhausted. Each
// route uses RATE_LIMIT_OPTIONS = { max: 60, windowMs: 60_000 } —
// the test asserts uniform behavior across the surface so behavior
// drift between routes surfaces as a test failure (consistent UX,
// predictable upstream load).
//
// SENIOR ARCHITECT NOTE: routes are exercised in parallel describe
// blocks rather than a single shared describe to give each route
// its own mock-state reset cycle. The fetch global is NOT stubbed
// because the rate-limit gate short-circuits BEFORE any upstream
// call — if a test hits the network, the gate is misbehaving.
//
// REJECTED ALTERNATIVE: integration test against a live rate-limit
// store. Rejected — non-deterministic; couples test runtime to
// store latency. Module-boundary mock of @/lib/rate-limiter is the
// hermetic option (consistent with existing test convention).

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailure: vi.fn(),
}))
vi.mock('@/lib/client-ip', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { NextRequest } from 'next/server'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'

import { GET as GET_CVES } from '../cves/route'
import { GET as GET_GREYNOISE } from '../greynoise/route'
import { GET as GET_CYBERNEWS } from '../cybernews/route'

function makeRequest(path: string): NextRequest {
  return new NextRequest(`https://localhost${path}`, { method: 'GET' })
}

function rateLimitedResult() {
  // Bucket exhausted: limited=true, remaining=0, resetAt 30s in the future
  return {
    limited: true,
    remaining: 0,
    resetAt: Date.now() + 30_000,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api/external — R-API-09 rate-limit gate', () => {
  // ─── T-EX01: cves route returns 429 when bucket exhausted ──────────────────

  it('T-EX01 — /api/cves returns 429 with Retry-After when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(rateLimitedResult())
    // fetch must NOT be invoked — set up a sentinel that fails the test if it is
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const res = await GET_CVES(makeRequest('/api/cves'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
    // recordFailure must NOT be called when already limited (no point
    // burning budget against a request we just rejected)
    expect(recordFailure).not.toHaveBeenCalled()
  })

  // ─── T-EX02: greynoise route returns 429 when bucket exhausted ─────────────

  it('T-EX02 — /api/greynoise returns 429 with Retry-After when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(rateLimitedResult())
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const res = await GET_GREYNOISE(makeRequest('/api/greynoise'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(recordFailure).not.toHaveBeenCalled()
  })

  // ─── T-EX03: cybernews route returns 429 when bucket exhausted ─────────────

  it('T-EX03 — /api/cybernews returns 429 with Retry-After when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(rateLimitedResult())
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const res = await GET_CYBERNEWS(makeRequest('/api/cybernews'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(recordFailure).not.toHaveBeenCalled()
  })
})
