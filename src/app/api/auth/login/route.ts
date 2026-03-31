import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata } from '@/lib/auth-server'
import { authenticateUser, createSession, writeAuditLog } from '@/lib/soc-store-adapter'

interface LoginBody {
  username?: unknown
  password?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-memory rate limiter: yalnizca basarisiz denemeleri sayar (IP bazli)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 dakika

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) return false
  return entry.count >= RATE_LIMIT_MAX
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count++
  }
}

function clearFailedAttempts(ip: string): void {
  rateLimitMap.delete(ip)
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Cok fazla basarisiz deneme. Lutfen 5 dakika bekleyin.' },
      { status: 429 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as LoginBody
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !password) {
    return NextResponse.json({ error: 'Kullanici adi ve sifre gerekli.' }, { status: 400 })
  }

  try {
    const user = await authenticateUser(username, password)
    if (!user) {
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Hatali kullanici adi veya sifre.' }, { status: 401 })
    }

    clearFailedAttempts(ip)

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
