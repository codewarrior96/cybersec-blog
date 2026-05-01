import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata } from '@/lib/auth-server'
import { getClientIp } from '@/lib/client-ip'
import { getReservedUsernameError, isReservedUsername } from '@/lib/identity-rules'
import {
  getDisplayNameError,
  getPasswordError,
  getUsernameFormatError,
  isAllowedUsername,
  isValidDisplayName,
  isValidPassword,
} from '@/lib/identity-validation'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
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

// Match login parity: same 10/5-min window keyed off the client IP.
// Threat model for register differs from login (account-flood + scrypt
// DoS rather than credential brute-force), so this counts EVERY attempt
// (incl. success) — login only counts failures. Both share the same
// in-memory limiter; H3 (Vercel multi-instance distribution) is a
// separate stage.
const REGISTER_RATE_LIMIT = {
  bucket: 'auth.register',
  max: 10,
  windowMs: 5 * 60 * 1000,
} as const

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  const rate = checkRateLimit(ip, REGISTER_RATE_LIMIT)
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Cok fazla kayit denemesi. Lutfen 5 dakika bekleyin.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    )
  }

  // Count every register POST toward the bucket — short-circuits before
  // password hashing so scrypt CPU is never invoked on a throttled IP.
  recordFailure(ip, REGISTER_RATE_LIMIT)

  const body = (await request.json().catch(() => ({}))) as RegisterBody
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!username || !displayName || !password || !confirmPassword) {
    return NextResponse.json({ error: 'Tum kayit alanlari zorunlu.' }, { status: 400 })
  }

  if (!isAllowedUsername(username)) {
    return NextResponse.json({ error: getUsernameFormatError() }, { status: 400 })
  }

  if (isReservedUsername(username)) {
    return NextResponse.json({ error: getReservedUsernameError() }, { status: 400 })
  }

  if (!isValidDisplayName(displayName)) {
    return NextResponse.json({ error: getDisplayNameError() }, { status: 400 })
  }

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: getPasswordError() }, { status: 400 })
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
    if (message === 'Reserved username') {
      return NextResponse.json({ error: getReservedUsernameError() }, { status: 400 })
    }

    console.error('[auth/register] Registration failed:', error)
    return NextResponse.json({ error: 'Kayit servisi su anda kullanilamiyor.' }, { status: 503 })
  }
}
