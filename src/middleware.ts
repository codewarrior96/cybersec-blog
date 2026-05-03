import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth-shared'

// ─── Edge security gates ─────────────────────────────────────────────────────
//
// Two layered checks fire on /api/* mutations (POST/PUT/PATCH/DELETE).
// Read-only methods (GET/HEAD/OPTIONS) and non-API routes pass through
// untouched. Both layers run BEFORE any route handler executes.
//
//   1. csrfCheck (Stage 4 / Audit H1)
//      Origin or Referer must resolve to the request host. Industry-
//      standard CSRF defense (Next.js docs, GitHub, Stripe). Mismatch
//      → 403 Origin mismatch.
//
//   2. sessionPresenceCheck (Stage 5 / Audit H5)
//      Cookie `soc_session` must be present (any non-empty value).
//      Defense-in-depth — route handlers' `requireSession` remains the
//      authoritative validator. Middleware only does cheap cookie-
//      presence so handlers don't run for obviously unauthenticated
//      calls. Same pattern: GitHub, Vercel, Stripe.
//
// Note (Phase 4.5): a Phase 4 third gate (emailVerifiedGate) was
// removed. The login endpoint itself now rejects unverified accounts
// with 403 EMAIL_NOT_VERIFIED before issuing a session cookie, so by
// the time a user has a `soc_session` they have already passed the
// emailVerified check. A duplicate gate at the edge added per-request
// latency (same-origin fetch to /api/auth/session) without adding
// security — its only effect was redundant defense-in-depth that
// produced confusing UX (verify-pending screen rendered inside the
// authenticated app shell). Login-time gating is the cleaner contract.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Auth bootstrap endpoints — must accept cookie-less mutations.
//   /api/auth/login          — credentials submission (creates session)
//   /api/auth/register       — account creation (no session in Phase 4.5)
//   /api/auth/logout         — destroys whatever session may or may not exist
//   /api/auth/verify/resend  — request new verification email; the user
//                              has no session at this point (Phase 4.5)
//                              so this must be reachable cookie-less
//   /api/auth/forgot         — request password-reset link (Phase 5);
//                              by definition the user has no session
//                              when recovering a forgotten password
//   /api/auth/reset          — consume a password-reset token (Phase 5);
//                              same reasoning as /forgot — no session
//                              required, CSRF still enforced
//   /api/auth/session        — GET, already excluded by MUTATING_METHODS check
//   /api/auth/verify         — GET, ditto
//   /api/auth/reset/validate — GET, ditto (Phase 5 token pre-check)
const PUBLIC_API_ROUTES = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/verify/resend',
  '/api/auth/forgot',
  '/api/auth/reset',
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

export function middleware(request: NextRequest) {
  // /api/* branch — layered edge gates, then pass through.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const csrfResponse = csrfCheck(request)
    if (csrfResponse) return csrfResponse

    const sessionResponse = sessionPresenceCheck(request)
    if (sessionResponse) return sessionResponse

    return NextResponse.next()
  }

  // Non-API branch — header rewrite + dev cache headers.
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

// Matcher includes /api/* (so the CSRF gate runs) and excludes static
// assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
