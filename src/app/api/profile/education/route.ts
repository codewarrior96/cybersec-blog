import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { createPortfolioEducation } from '@/lib/soc-store-adapter'
import { parseEducationInput, validateEducationInput } from '@/lib/portfolio-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const input = parseEducationInput(body)
  const validationError = validateEducationInput(input)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const education = await createPortfolioEducation(
    guard.session.user.id,
    input,
    guard.session.user,
    getRequestMetadata(request),
  )

  if (!education) {
    return NextResponse.json({ error: 'Egitim kaydi olusturulamadi.' }, { status: 404 })
  }

  return NextResponse.json({ education }, { status: 201 })
}
