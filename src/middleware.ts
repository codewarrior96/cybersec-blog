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
//      authoritative validator (it loads the session record, checks
//      expiry, etc.). Middleware only does cheap cookie-presence so
//      handlers don't run for obviously unauthenticated calls. Same
//      pattern: GitHub, Vercel, Stripe.
//
// Allowed-host derivation: `request.nextUrl.host` automatically covers
// the production domain, Vercel preview deploys, and localhost — no
// hardcoded allowlist needed.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Auth bootstrap endpoints — must accept cookie-less mutations.
//   /api/auth/login    — credentials submission (creates session)
//   /api/auth/register — account creation (creates session)
//   /api/auth/logout   — destroys whatever session may or may not exist
//                        (idempotent + harmless without prior session)
//   /api/auth/session  — GET, already excluded by MUTATING_METHODS check
const PUBLIC_API_ROUTES = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
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

  // Non-API branch — existing behavior preserved verbatim.
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
