import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata, getServerSessionFromRequest } from '@/lib/auth-server'
import { deleteSession, writeAuditLog } from '@/lib/soc-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const metadata = getRequestMetadata(request)
  const session = await getServerSessionFromRequest(request)

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await deleteSession(token)
  }

  if (session) {
    await writeAuditLog({
      actorUserId: session.user.id,
      action: 'auth.logout',
      entityType: 'session',
      entityId: token ?? null,
      metadata,
    })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
