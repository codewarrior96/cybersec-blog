import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import {
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
}
