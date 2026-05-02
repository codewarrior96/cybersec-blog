import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getRequestMetadata } from '@/lib/auth-server'
import { getClientIp } from '@/lib/client-ip'
import { sendEmail } from '@/lib/email'
import { getReservedUsernameError, isReservedUsername } from '@/lib/identity-rules'
import {
  getDisplayNameError,
  getEmailFormatError,
  getPasswordError,
  getUsernameFormatError,
  isAllowedUsername,
  isValidDisplayName,
  isValidPassword,
  validateEmail,
} from '@/lib/identity-validation'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { hashPassword } from '@/lib/security'
import { createSession, readUserByEmailKey, registerUser } from '@/lib/soc-store-adapter'

interface RegisterBody {
  username?: unknown
  displayName?: unknown
  email?: unknown
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

const VERIFY_TOKEN_BYTES = 32
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

function appBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  // Fallback: derive from the request itself. Works in dev + preview
  // deploys where NEXT_PUBLIC_APP_URL may not be set.
  return `${request.nextUrl.protocol}//${request.nextUrl.host}`
}

function buildVerificationEmail(displayName: string, verifyUrl: string): { subject: string; html: string; text: string } {
  const safeName = displayName || 'Operator'
  const subject = 'BREACH LAB — Email adresini doğrula'
  const text = [
    `Merhaba ${safeName},`,
    '',
    'BREACH LAB hesabını oluşturduğunu görüyorum. Email adresini doğrulamak için aşağıdaki bağlantıya tıkla:',
    '',
    verifyUrl,
    '',
    'Bu bağlantı 24 saat geçerli. Sen istemediysen bu maili görmezden gelebilirsin.',
    '',
    '— BREACH LAB',
  ].join('\n')
  const html = `<!doctype html>
<html><body style="font-family:JetBrains Mono,Menlo,monospace;background:#000;color:#e2e8f0;padding:24px;">
<div style="max-width:560px;margin:0 auto;border:1px solid #00ff4140;border-radius:12px;padding:24px;background:#040806;">
<p style="color:#00ff41;letter-spacing:0.2em;font-size:11px;margin:0 0 12px;">BREACH LAB</p>
<h1 style="color:#f8fafc;font-size:18px;margin:0 0 12px;">Email adresini doğrula</h1>
<p style="line-height:1.6;color:#cbd5e1;font-size:13px;">Merhaba ${safeName}, BREACH LAB hesabını oluşturdun. Aşağıdaki bağlantıya tıklayarak email adresini doğrula:</p>
<p style="margin:16px 0;"><a href="${verifyUrl}" style="display:inline-block;background:#00ff41;color:#000;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none;">Email adresini doğrula</a></p>
<p style="font-size:11px;color:#94a3b8;line-height:1.6;">Bağlantı 24 saat geçerli. Bağlantı çalışmıyorsa şu URL'yi tarayıcına yapıştırabilirsin:<br/><span style="color:#00ff41;word-break:break-all;">${verifyUrl}</span></p>
<p style="font-size:10px;color:#64748b;margin-top:24px;">Sen istemediysen bu maili görmezden gelebilirsin.</p>
</div></body></html>`
  return { subject, html, text }
}

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
  const emailRaw = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!username || !displayName || !emailRaw || !password || !confirmPassword) {
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

  const emailResult = validateEmail(emailRaw)
  if (!emailResult.ok) {
    return NextResponse.json({ error: getEmailFormatError() }, { status: 400 })
  }
  const email = emailResult.value
  const emailKey = email // already trimmed+lowercased by validateEmail

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: getPasswordError() }, { status: 400 })
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Sifreler birbiriyle eslesmiyor.' }, { status: 400 })
  }

  // Email-uniqueness pre-check. Storage layer has its own concurrent-race
  // guard via readUserByEmailKey check inside registerUser, so this is the
  // user-facing fast path.
  const emailTaken = await readUserByEmailKey(emailKey)
  if (emailTaken?.isActive) {
    return NextResponse.json({ error: 'Bu email adresi zaten kullaniliyor.' }, { status: 409 })
  }

  const metadata = getRequestMetadata(request)
  const emailVerifyToken = randomBytes(VERIFY_TOKEN_BYTES).toString('hex')
  const emailVerifyTokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString()

  try {
    const user = await registerUser({
      username,
      displayName,
      role: 'viewer',
      passwordHash: hashPassword(password),
      metadata,
      email,
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    })

    const session = await createSession(user, metadata)

    // Fire verification email. Failures don't roll back the user — the
    // /verify/resend endpoint (Phase 4) lets the operator request a new
    // link. We surface the failure as a `warning` so the client can show
    // a "couldn't send email" hint on the verify-pending screen.
    const verifyUrl = `${appBaseUrl(request)}/verify?token=${encodeURIComponent(emailVerifyToken)}`
    const emailContent = buildVerificationEmail(user.displayName, verifyUrl)
    const emailResultSend = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    })

    let warning: string | undefined
    if (!emailResultSend.ok) {
      console.warn('[auth/register] Verification email failed to send:', emailResultSend.error)
      warning = 'Verification email could not be sent. Please request a resend.'
    }

    const response = NextResponse.json({
      authenticated: true,
      user,
      expiresAt: session.expiresAt,
      ...(warning ? { warning } : {}),
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
    if (message === 'Email already exists') {
      return NextResponse.json({ error: 'Bu email adresi zaten kullaniliyor.' }, { status: 409 })
    }
    if (message === 'Reserved username') {
      return NextResponse.json({ error: getReservedUsernameError() }, { status: 400 })
    }

    console.error('[auth/register] Registration failed:', error)
    return NextResponse.json({ error: 'Kayit servisi su anda kullanilamiyor.' }, { status: 503 })
  }
}
