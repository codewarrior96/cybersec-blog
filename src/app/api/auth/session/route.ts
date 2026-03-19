import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionFromRequest } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getServerSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 })
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    expiresAt: session.expiresAt,
  })
}
