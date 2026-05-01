import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// ─── CSRF gate (Stage 4 / Audit H1) ──────────────────────────────────────────
//
// State-changing API mutations require the request's Origin (or Referer
// fallback) to match the request host. Industry-standard pattern (Next.js
// docs, GitHub, Stripe). Same-origin form submissions and fetches pass
// through transparently; cross-site forged requests are rejected at the
// edge with 403 before any handler runs.
//
// Allowed-host derivation: `request.nextUrl.host` automatically covers the
// production domain, Vercel preview deploys, and localhost — no hardcoded
// allowlist needed.
//
// Stage 5 (audit H5) will extend this same file with a session-required
// gate on protected /api routes.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

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

export function middleware(request: NextRequest) {
  // /api/* branch — CSRF gate on mutations, otherwise pass through.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const csrfResponse = csrfCheck(request)
    if (csrfResponse) return csrfResponse
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
