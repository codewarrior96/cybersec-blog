import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata } from '@/lib/auth-server'
import { hashPassword } from '@/lib/security'
import { createSession, registerUser } from '@/lib/soc-store-adapter'

interface RegisterBody {
  username?: unknown
  displayName?: unknown
  password?: unknown
  confirmPassword?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAllowedUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(username)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as RegisterBody
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!username || !displayName || !password || !confirmPassword) {
    return NextResponse.json({ error: 'Tum kayit alanlari zorunlu.' }, { status: 400 })
  }

  if (!isAllowedUsername(username)) {
    return NextResponse.json(
      { error: 'Kullanici adi 3-32 karakter olmali ve sadece harf, rakam, nokta, tire veya alt cizgi icermeli.' },
      { status: 400 },
    )
  }

  if (displayName.length < 2) {
    return NextResponse.json({ error: 'Gorunen ad en az 2 karakter olmali.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Sifre en az 8 karakter olmali.' }, { status: 400 })
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Sifreler birbiriyle eslesmiyor.' }, { status: 400 })
  }

  const metadata = getRequestMetadata(request)

  try {
    const user = await registerUser({
      username,
      displayName,
      role: 'viewer',
      passwordHash: hashPassword(password),
      metadata,
    })

    const session = await createSession(user, metadata)
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kayit basarisiz oldu.'
    if (message === 'User already exists') {
      return NextResponse.json({ error: 'Bu kullanici adi zaten kullaniliyor.' }, { status: 409 })
    }

    console.error('[auth/register] Registration failed:', error)
    return NextResponse.json({ error: 'Kayit servisi su anda kullanilamiyor.' }, { status: 503 })
  }
}
