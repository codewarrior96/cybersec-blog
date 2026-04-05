import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
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
