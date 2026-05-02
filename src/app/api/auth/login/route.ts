import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata } from '@/lib/auth-server'
import { getClientIp } from '@/lib/client-ip'
import { checkRateLimit, clearAttempts, recordFailure } from '@/lib/rate-limiter'
import { authenticateUser, createSession, readUserByUsername, writeAuditLog } from '@/lib/soc-store-adapter'

interface LoginBody {
  username?: unknown
  password?: unknown
  remember?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOGIN_RATE_LIMIT = {
  bucket: 'auth.login',
  max: 10,
  windowMs: 5 * 60 * 1000,
} as const

const MAX_USERNAME_LENGTH = 64
const MAX_PASSWORD_LENGTH = 256

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  const rate = checkRateLimit(ip, LOGIN_RATE_LIMIT)
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Cok fazla basarisiz deneme. Lutfen 5 dakika bekleyin.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    )
  }

  const body = (await request.json().catch(() => ({}))) as LoginBody
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const remember = body.remember !== false

  if (!username || !password) {
    return NextResponse.json({ error: 'Kullanici adi ve sifre gerekli.' }, { status: 400 })
  }

  if (username.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'Gecersiz kullanici adi veya sifre.' }, { status: 400 })
  }

  try {
    const user = await authenticateUser(username, password)
    if (!user) {
      recordFailure(ip, LOGIN_RATE_LIMIT)
      return NextResponse.json({ error: 'Hatali kullanici adi veya sifre.' }, { status: 401 })
    }

    // Credentials were valid — clear the failed-attempts counter regardless
    // of whether we ultimately mint a session below. Brute-force protection
    // is about wrong-password volume; the right-password-but-unverified path
    // shouldn't be punished by a stale rate-limit window.
    clearAttempts(ip, LOGIN_RATE_LIMIT.bucket)

    // ─── Phase 4.5 gate: verification before session ─────────────────────
    // Auth Flow Refactor moves the email-verified gate from the edge
    // middleware (which auto-loaded under a session cookie) to the login
    // endpoint. We only mint a session for verified accounts; an
    // unverified account gets a distinct 403 EMAIL_NOT_VERIFIED so the
    // login form can offer a "resend verification" affordance instead of
    // a generic credential error.
    //
    // Enumeration tradeoff: distinguishing "wrong password" (401) from
    // "right password, unverified email" (403) reveals that the username
    // exists. We accept this for UX — the alternative (silently failing
    // an authenticated-but-unverified login) is confusing and pushes
    // users toward password resets that won't help. Register-time
    // emailKey uniqueness already gives the same enumeration signal, so
    // login parity here is consistent.
    if (user.emailVerified === false) {
      // Best-effort email lookup so the frontend can pre-fill the
      // resend form. Falls back gracefully when the active store is
      // memory/postgres (those branches return null from this helper).
      const fullUser = await readUserByUsername(username).catch(() => null)
      const email = fullUser?.email ?? ''
      return NextResponse.json(
        {
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Email henüz doğrulanmamış. Mail kutunu kontrol et veya yeniden mail iste.',
          email,
        },
        { status: 403 },
      )
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
      ...(remember ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS } : {}),
    })

    return response
  } catch (error) {
    console.error('[auth/login] Failed to create session:', error)
    const debugHint =
      process.env.NODE_ENV === 'production'
        ? ''
        : ' Gelistirme icin SOC_STORAGE=memory kullanip sunucuyu yeniden baslatin.'
    return NextResponse.json(
      { error: `Kimlik dogrulama servisi su anda kullanilamiyor.${debugHint}` },
      { status: 503 },
    )
  }
}
