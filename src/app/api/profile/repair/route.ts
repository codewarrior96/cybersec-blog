import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { repairPortfolioStarterData } from '@/lib/soc-store-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const profile = await repairPortfolioStarterData(
    guard.session.user.id,
    guard.session.user,
    getRequestMetadata(request),
  )

  if (!profile) {
    return NextResponse.json({ error: 'Profil onarimi tamamlanamadi.' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
