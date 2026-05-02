import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth-shared'

// ─── Edge security gates ─────────────────────────────────────────────────────
//
// Three layered checks fire on different request shapes. Read-only methods
// pass through the API gates; non-API navigation has its own gate. All run
// at the edge BEFORE any route handler executes.
//
//   1. csrfCheck (Stage 4 / Audit H1)
//      Origin or Referer must resolve to the request host on /api/*
//      mutations. Industry-standard CSRF defense.
//
//   2. sessionPresenceCheck (Stage 5 / Audit H5)
//      Cookie `soc_session` must be present on /api/* mutations except
//      auth-bootstrap routes. Defense-in-depth — route handlers'
//      `requireSession` remains the authoritative validator.
//
//   3. emailVerifiedGate (Phase 4 of email foundation)
//      Browser navigation only (non-API). Logged-in users with
//      emailVerified=false are redirected to /auth/verify-pending
//      unless they're already on an auth-bootstrap or verify path.
//      Status is read via a same-origin fetch to /api/auth/session
//      (Edge fetch, no DB import). Lookup failures fall through —
//      better to allow access during outage than lock users out.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Auth bootstrap endpoints — must accept cookie-less mutations.
//   /api/auth/login          — credentials submission (creates session)
//   /api/auth/register       — account creation (creates session)
//   /api/auth/logout         — destroys whatever session may or may not exist
//   /api/auth/verify/resend  — request new verification email; the user
//                              has a session but cannot reach gated routes
//                              yet, so this must be reachable from
//                              /auth/verify-pending without a CSRF or
//                              session-presence regression.
//   /api/auth/session        — GET, already excluded by MUTATING_METHODS check
//   /api/auth/verify         — GET, ditto
const PUBLIC_API_ROUTES = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/verify/resend',
])

// Pages an unverified user CAN reach. Includes auth-bootstrap routes
// (login/register) so they can switch accounts, /verify so they can
// consume a token, /auth/verify-pending which is the redirect target,
// and /forgot + /reset (Phase 5) so they can recover credentials even
// before email verification.
const PUBLIC_UNVERIFIED_PAGES = new Set<string>([
  '/',
  '/login',
  '/register',
  '/verify',
  '/auth/verify-pending',
  '/forgot',
  '/reset',
  // Public marketing surfaces (no login wall in place today)
  '/blog',
  '/roadmap',
])

function extractClaimedHost(request: NextRequest): string | null {
  const originHeader = request.headers.get('origin')
  if (originHeader) {
    try {
      return new URL(originHeader).host
    } catch {
      return null
    }
  }
  const refererHeader = request.headers.get('referer')
  if (refererHeader) {
    try {
      return new URL(refererHeader).host
    } catch {
      return null
    }
  }
  return null
}

function csrfCheck(request: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(request.method)) return null

  const requestHost = request.nextUrl.host
  const claimedHost = extractClaimedHost(request)

  if (claimedHost === null || claimedHost !== requestHost) {
    return NextResponse.json({ error: 'Origin mismatch' }, { status: 403 })
  }
  return null
}

function sessionPresenceCheck(request: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(request.method)) return null
  if (PUBLIC_API_ROUTES.has(request.nextUrl.pathname)) return null

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }
  return null
}

function isPublicUnverifiedPage(pathname: string): boolean {
  if (PUBLIC_UNVERIFIED_PAGES.has(pathname)) return true
  // Allow any /auth/* nested routes (verify-pending lives there;
  // future flows may add more sub-routes).
  if (pathname.startsWith('/auth/')) return true
  // Allow blog post detail pages.
  if (pathname.startsWith('/blog/')) return true
  return false
}

async function emailVerifiedGate(request: NextRequest): Promise<NextResponse | null> {
  // Only runs on browser HTML navigation. The matcher already excludes
  // _next assets etc.; the additional method gate here guards against
  // odd POST navigations from form submissions to non-API routes.
  if (request.method !== 'GET') return null

  // No session cookie → page-level requireSession (or public access)
  // handles the request. We don't redirect logged-out users; the email
  // gate only applies to authenticated-but-unverified accounts.
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null

  const pathname = request.nextUrl.pathname
  if (isPublicUnverifiedPage(pathname)) return null

  let emailVerified: boolean | null = null
  try {
    // Edge-compatible same-origin fetch. /api/auth/session is read-only,
    // skips both CSRF and session-presence gates above, and returns
    // { authenticated, user: { ..., emailVerified } } as of Phase 4.
    const sessionUrl = new URL('/api/auth/session', request.nextUrl.origin)
    const res = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    })
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { authenticated?: boolean; user?: { emailVerified?: boolean } | null }
        | null
      if (json?.authenticated && json.user) {
        emailVerified = Boolean(json.user.emailVerified)
      }
    }
  } catch (err) {
    // Service degradation — fall through. Better UX than locking
    // everyone out on a transient blip.
    console.warn('[middleware/emailVerifiedGate] session lookup failed:', err)
    return null
  }

  // No authenticated user (cookie stale, etc.) — fall through; route-
  // level requireSession will handle.
  if (emailVerified === null) return null

  if (!emailVerified) {
    const redirectUrl = new URL('/auth/verify-pending', request.nextUrl.origin)
    return NextResponse.redirect(redirectUrl)
  }

  return null
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // /api/* branch — layered edge gates, then pass through.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const csrfResponse = csrfCheck(request)
    if (csrfResponse) return csrfResponse

    const sessionResponse = sessionPresenceCheck(request)
    if (sessionResponse) return sessionResponse

    return NextResponse.next()
  }

  // Non-API branch — email gate first (may redirect), then existing
  // header rewrite + dev cache headers.
  const gateResponse = await emailVerifiedGate(request)
  if (gateResponse) return gateResponse

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (process.env.NODE_ENV !== 'production') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

// Matcher widened from the prior `api`-excluding pattern to include /api/*
// (so the CSRF gate runs). Static-asset exclusions retained.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
