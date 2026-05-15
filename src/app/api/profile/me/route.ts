import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { sanitizeReportContent } from '@/lib/sanitize'
import { getPortfolioProfile, updatePortfolioProfile } from '@/lib/soc-store-adapter'
import { parseProfilePayload, validateProfilePayload } from '@/lib/portfolio-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const profile = await getPortfolioProfile(guard.session.user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Profil bulunamadi.' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PUT(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const payload = parseProfilePayload(body)

  // R-API-13 closure (Wave 2B) — defense-in-depth Layer 1: strip XSS
  // vectors from free-text profile fields (bio, headline) before storage.
  // 6th instance of the defense-in-depth two-layer pattern (R-13 / R-21
  // / R-15 / A-17 / R-API-05 lineage). Layer 2 is React/MDX safe-text
  // default at the profile render path. Sanitize runs BEFORE validate so
  // a fully-`<script>`-only bio sanitizes to empty string and is then
  // rejected by `validateProfilePayload` as required-field violation
  // (defense: AT-time UX feedback + render-path safety in one step).
  // SENIOR ARCHITECT NOTE: location/website/specialties/tools are short
  // strings without HTML-rendering intent; sanitize is currently scoped
  // to bio + headline (the markdown-friendly long-text fields). Future
  // R-UI render-path change that interpolates location/website/lists as
  // HTML would require extending sanitize scope here.
  payload.bio = sanitizeReportContent(payload.bio)
  payload.headline = sanitizeReportContent(payload.headline)

  const validationError = validateProfilePayload(payload)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const profile = await updatePortfolioProfile(
    guard.session.user.id,
    payload,
    guard.session.user,
    getRequestMetadata(request),
  )

  if (!profile) {
    return NextResponse.json({ error: 'Profil guncellenemedi.' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
