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
    try {
      await deleteSession(token)
    } catch (error) {
      console.error('[auth/logout] Failed to delete session:', error)
    }
  }

  if (session) {
    try {
      await writeAuditLog({
        actorUserId: session.user.id,
        action: 'auth.logout',
        entityType: 'session',
        entityId: token ?? null,
        metadata,
      })
    } catch (error) {
      console.error('[auth/logout] Failed to write audit log:', error)
    }
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
