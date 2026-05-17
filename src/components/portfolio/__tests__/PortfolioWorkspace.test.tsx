// @vitest-environment jsdom
//
// Wave 10 — A-24 closure regression guard for the profile-edit persistence
// bug (Router Cache stale on soft-nav return).
//
// The bug: /portfolio Server Component is force-dynamic + revalidate=0
// (bypasses server-side Full Route Cache + Data Cache) but does NOT
// affect the client-side App Router Cache. After a save handler success,
// soft-navigating away and back reuses the cached route segment with
// the original (now stale) `initialProfile` prop. useEffect refetches
// from /api/profile/me, causing a visible stale→fresh flicker.
//
// Fix: useRouter().refresh() after every save handler success in
// PortfolioWorkspace.tsx — invalidates Router Cache for the current
// route + triggers Server Component data refetch on next render.
//
// SENIOR ARCHITECT NOTE: this is a call-site contract assertion, NOT
// an end-to-end cache-behavior test. jsdom does not simulate Next.js
// App Router Cache; only Playwright/manual smoke can verify the actual
// stale→fresh elimination. T-PE-PERSIST guards against the specific
// regression of "saveProfile no longer calls router.refresh()" —
// which is the call-site condition the fix relies on. Other save
// handlers (uploadAvatar, removeAvatar, save/deleteCertification,
// save/deleteEducation) share the same router.refresh() pattern in
// the same file under the same useRouter hook, so this single
// assertion covers the family by code-review-adjacency.
//
// REJECTED ALTERNATIVE: render-all-handler matrix test. Rejected —
// would multiply LOC × 7 for marginal additional safety; the contract
// is uniform across handlers and any future drift surfaces in code
// review of PortfolioWorkspace.tsx itself.

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))
vi.mock('@/lib/auth-client', () => ({
  getAuthSession: vi.fn(),
}))

import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-client'
import PortfolioWorkspace from '@/components/portfolio/PortfolioWorkspace'
import type { PortfolioProfileRecord } from '@/lib/portfolio-profile'

// ─── fixtures ───────────────────────────────────────────────────────────────

const SESSION_USER = {
  id: 1,
  username: 'operator',
  displayName: 'Operator',
  role: 'viewer' as const,
  emailVerified: true,
}

function buildProfile(overrides?: Partial<PortfolioProfileRecord['profile']>): PortfolioProfileRecord {
  return {
    user: SESSION_USER,
    profile: {
      headline: 'Initial headline',
      bio: 'Initial bio',
      location: '',
      socialLinks: {},
      specialties: [],
      tools: [],
      avatarPath: null,
      avatarName: null,
      avatarMimeType: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
    certifications: [],
    education: [],
  }
}

// ─── test ────────────────────────────────────────────────────────────────────

describe('PortfolioWorkspace — A-24 Router Cache invalidation (Wave 10)', () => {
  const refreshSpy = vi.fn()

  beforeEach(() => {
    refreshSpy.mockClear()
    vi.mocked(useRouter).mockReturnValue({
      refresh: refreshSpy,
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as never)
    vi.mocked(getAuthSession).mockResolvedValue({
      authenticated: true,
      user: SESSION_USER,
    } as never)
  })

  it('T-PE-PERSIST — saveProfile success calls router.refresh() (Router Cache invalidation)', async () => {
    const initialProfile = buildProfile()

    // Mock fetch for both:
    //   - GET /api/profile/me (auto-sync useEffect on mount)
    //   - PUT /api/profile/me (saveProfile success path under test)
    // Both return the same profile shape; the GET call's response also
    // satisfies the useEffect's `setData(payload.profile)` branch.
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      return new Response(
        JSON.stringify({ profile: initialProfile }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ) as Response & { _method?: string; _url?: typeof url; _init?: typeof init }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <PortfolioWorkspace
        initialProfile={initialProfile}
        initialTab="profile"
        editable
      />,
    )

    // Wait for useEffect auto-sync to complete (the canEdit gate fires
    // saveProfile's no-op early-return until this resolves). With
    // editable={true} the effect goes straight to the GET fetch path
    // and skips getAuthSession; wait on the fetch instead.
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        ([, init]) => !(init as RequestInit | undefined)?.method || (init as RequestInit | undefined)?.method === 'GET',
      )
      expect(getCalls.length).toBeGreaterThanOrEqual(1)
    })

    // Click "Profili Kaydet" button (saveProfile() trigger).
    // Use findByRole so RTL waits for the button to be present + enabled.
    const saveButton = await screen.findByRole('button', { name: /Profili Kaydet/i })
    saveButton.click()

    // saveProfile is async; wait for the PUT to fire + router.refresh
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled()
    })

    // Sanity: fetch was invoked with PUT /api/profile/me at least once
    const putCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
    )
    expect(putCalls.length).toBeGreaterThanOrEqual(1)

    vi.unstubAllGlobals()
  })

  // ─── A-25 closure (Wave 11) socialLinks tests ─────────────────────────────

  it('T-SL-PERSIST — saveProfile PUT body contains nested socialLinks with all 6 platform fields', async () => {
    const initialProfile = buildProfile({
      socialLinks: { github: 'codewarrior96', personal: 'https://example.com' },
    })

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({ profile: initialProfile }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <PortfolioWorkspace
        initialProfile={initialProfile}
        initialTab="profile"
        editable
      />,
    )

    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        ([, init]) => !(init as RequestInit | undefined)?.method || (init as RequestInit | undefined)?.method === 'GET',
      )
      expect(getCalls.length).toBeGreaterThanOrEqual(1)
    })

    const saveButton = await screen.findByRole('button', { name: /Profili Kaydet/i })
    saveButton.click()

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      )
      expect(putCalls.length).toBeGreaterThanOrEqual(1)
    })

    // Inspect PUT body — must contain nested socialLinks with all 6 fields.
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
    )
    expect(putCall).toBeTruthy()
    const body = JSON.parse(((putCall![1] as RequestInit).body ?? '{}') as string)
    expect(body.socialLinks).toBeDefined()
    expect(body.socialLinks).toHaveProperty('github')
    expect(body.socialLinks).toHaveProperty('linkedin')
    expect(body.socialLinks).toHaveProperty('tryhackme')
    expect(body.socialLinks).toHaveProperty('hackthebox')
    expect(body.socialLinks).toHaveProperty('twitter')
    expect(body.socialLinks).toHaveProperty('personal')
    // Pre-populated values surface in the PUT
    expect(body.socialLinks.github).toBe('codewarrior96')
    expect(body.socialLinks.personal).toBe('https://example.com')
    // Empty platforms send empty strings (server-side parseSocialLinks
    // trims + drops empty keys before storage)
    expect(body.socialLinks.twitter).toBe('')

    // body.website MUST NOT exist (Wave 11 removed the field entirely)
    expect(body).not.toHaveProperty('website')

    vi.unstubAllGlobals()
  })

  it('T-SL-RENDER — display surface renders populated social links as anchor tags with constructed URLs', async () => {
    const initialProfile = buildProfile({
      socialLinks: {
        github: 'codewarrior96',
        linkedin: 'salim-aybasti',
        tryhackme: 'zerox',
        hackthebox: 'username',
        twitter: 'handle',
        personal: 'https://example.com/about',
      },
    })

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({ profile: initialProfile }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <PortfolioWorkspace
        initialProfile={initialProfile}
        initialTab="profile"
        editable
      />,
    )

    // All 6 platform anchors should be present with correctly constructed URLs.
    // 5 platform handles → canonical platform host URLs; personal → verbatim.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /GitHub.*codewarrior96/i })).toHaveAttribute(
        'href',
        'https://github.com/codewarrior96',
      )
    })
    expect(screen.getByRole('link', { name: /LinkedIn.*salim-aybasti/i })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/salim-aybasti',
    )
    expect(screen.getByRole('link', { name: /TryHackMe.*zerox/i })).toHaveAttribute(
      'href',
      'https://tryhackme.com/p/zerox',
    )
    expect(screen.getByRole('link', { name: /HackTheBox.*username/i })).toHaveAttribute(
      'href',
      'https://app.hackthebox.com/profile/username',
    )
    expect(screen.getByRole('link', { name: /Twitter.*handle/i })).toHaveAttribute(
      'href',
      'https://x.com/handle',
    )
    expect(screen.getByRole('link', { name: /Kişisel Site.*example/i })).toHaveAttribute(
      'href',
      'https://example.com/about',
    )

    vi.unstubAllGlobals()
  })

  // ─── A-27 closure (Wave 13 Faz 13.C) avatar SSR resolve tests ─────────────

  it('T-AV-SSR-PROP — when initialAvatarUrl prop provided, all 3 <img> sites consume it directly (no /api/profile/avatar fetch)', async () => {
    const initialProfile = buildProfile({
      avatarPath: 'avatars/user-1/avatar.png',
      avatarName: 'avatar.png',
      avatarMimeType: 'image/png',
    })
    const ssrSignedUrl = 'https://supabase.test/storage/sign/avatars/user-1/avatar.png?token=ssr-jwt-stub'

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({ profile: initialProfile }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <PortfolioWorkspace
        initialProfile={initialProfile}
        initialTab="profile"
        editable
        initialAvatarUrl={ssrSignedUrl}
      />,
    )

    // Wait for the component to settle (auto-sync useEffect runs once)
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        ([, init]) => !(init as RequestInit | undefined)?.method || (init as RequestInit | undefined)?.method === 'GET',
      )
      expect(getCalls.length).toBeGreaterThanOrEqual(1)
    })

    // All <img alt="..."> tags carry the SSR-resolved URL verbatim. The
    // 3 render sites (header thumbnail + edit form preview + read-side
    // card) all share the same src, so the browser dedupes natively —
    // no /api/profile/avatar/[userId] fetch is required.
    const avatarImgs = screen.getAllByRole('img', { name: /Operator/ })
    expect(avatarImgs.length).toBeGreaterThanOrEqual(1)
    for (const img of avatarImgs) {
      expect(img.getAttribute('src')).toBe(ssrSignedUrl)
    }

    // Critical: NO fetch went to the legacy /api/profile/avatar/[userId]
    // endpoint. Sites already have the SSR-resolved URL from props.
    const avatarApiCalls = fetchMock.mock.calls.filter(([url]) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url instanceof Request ? url.url : ''
      return urlStr.includes('/api/profile/avatar/')
    })
    expect(avatarApiCalls.length).toBe(0)

    vi.unstubAllGlobals()
  })

  it('T-AV-SSR-FALLBACK — when initialAvatarUrl prop absent, avatarSrc falls back to legacy /api/profile/avatar/<userId> pattern', async () => {
    const initialProfile = buildProfile({
      avatarPath: 'avatars/user-1/avatar.png',
      avatarName: 'avatar.png',
      avatarMimeType: 'image/png',
    })

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({ profile: initialProfile }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <PortfolioWorkspace
        initialProfile={initialProfile}
        initialTab="profile"
        editable
        // initialAvatarUrl intentionally NOT passed — exercises the
        // graceful-degradation path (SSR resolve failed at server render
        // time OR sqlite-mode where Supabase signed URLs do not exist).
      />,
    )

    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        ([, init]) => !(init as RequestInit | undefined)?.method || (init as RequestInit | undefined)?.method === 'GET',
      )
      expect(getCalls.length).toBeGreaterThanOrEqual(1)
    })

    // All avatar <img> src values fall back to the legacy /api endpoint
    // pattern. With Cache-Control: private, max-age=20 on that route's
    // 307 response (Faz 13.C Phase B), the 3 sites still dedupe at the
    // browser HTTP cache layer within the 20s window.
    const avatarImgs = screen.getAllByRole('img', { name: /Operator/ })
    expect(avatarImgs.length).toBeGreaterThanOrEqual(1)
    for (const img of avatarImgs) {
      const src = img.getAttribute('src') ?? ''
      expect(src).toMatch(/\/api\/profile\/avatar\/1\?v=/)
    }

    vi.unstubAllGlobals()
  })
})
