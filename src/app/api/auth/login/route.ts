import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata } from '@/lib/auth-server'
import { authenticateUser, createSession, writeAuditLog } from '@/lib/soc-store'

interface LoginBody {
  username?: unknown
  password?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as LoginBody
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !password) {
    return NextResponse.json({ error: 'Kullanici adi ve sifre gerekli.' }, { status: 400 })
  }

  const user = await authenticateUser(username, password)
  if (!user) {
    return NextResponse.json({ error: 'Hatali kullanici adi veya sifre.' }, { status: 401 })
  }

  const metadata = getRequestMetadata(request)
  const session = await createSession(user, metadata)

  await writeAuditLog({
    actorUserId: user.id,
    action: 'auth.login',
    entityType: 'session',
    entityId: session.token,
    metadata,
  })

  const response = NextResponse.json({
    authenticated: true,
    user,
    expiresAt: session.expiresAt,
  })

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  })

  return response
}
