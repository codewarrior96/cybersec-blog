import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
  archivePortfolioEducation,
  deletePortfolioEducation,
  getPortfolioProfile,
  updatePortfolioEducation,
} from '@/lib/soc-store-adapter'
import { parseEducationInput, validateEducationInput } from '@/lib/portfolio-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const params = await Promise.resolve(context.params)
  const educationId = parseId(params.id)
  if (!educationId) {
    return NextResponse.json({ error: 'Gecersiz egitim kimligi.' }, { status: 400 })
  }

  const profile = await getPortfolioProfile(guard.session.user.id)
  const existing = profile?.education.find((item) => item.id === educationId)
  if (!existing) {
    return NextResponse.json({ error: 'Egitim kaydi bulunamadi.' }, { status: 404 })
  }

  // R-API-14 closure (Wave 5C): archive dispatch via ?action=archive.
  // Mirrors the certifications [id] route.
  const { searchParams } = new URL(request.url)
  if (searchParams.get('action') === 'archive') {
    const archived = await archivePortfolioEducation(
      educationId,
      guard.session.user.id,
      guard.session.user,
      getRequestMetadata(request),
    )
    if (!archived) {
      return NextResponse.json({ error: 'Egitim kaydi bulunamadi.' }, { status: 404 })
    }
    return NextResponse.json({ education: archived })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const input = parseEducationInput(body)
  const validationError = validateEducationInput(input)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const education = await updatePortfolioEducation(
    educationId,
    guard.session.user.id,
    input,
    guard.session.user,
    getRequestMetadata(request),
  )

  if (!education) {
    return NextResponse.json({ error: 'Egitim kaydi guncellenemedi.' }, { status: 404 })
  }

  return NextResponse.json({ education })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const params = await Promise.resolve(context.params)
  const educationId = parseId(params.id)
  if (!educationId) {
    return NextResponse.json({ error: 'Gecersiz egitim kimligi.' }, { status: 400 })
  }

  try {
    const education = await deletePortfolioEducation(
      educationId,
      guard.session.user.id,
      guard.session.user,
      getRequestMetadata(request),
    )

    if (!education) {
      return NextResponse.json({ error: 'Egitim kaydi bulunamadi.' }, { status: 404 })
    }

    return NextResponse.json({ education })
  } catch (error) {
    // R-API-14 closure (Wave 5C): NOT_ARCHIVED → 409 Conflict.
    if (error instanceof Error && error.message === 'NOT_ARCHIVED') {
      return NextResponse.json(
        { error: 'Egitim kaydi once arsivlenmeli. Lutfen PATCH ?action=archive ile arsivleyin.' },
        { status: 409 },
      )
    }
    throw error
  }
}
