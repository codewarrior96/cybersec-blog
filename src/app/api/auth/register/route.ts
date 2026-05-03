import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestMetadata } from '@/lib/auth-server'
import { getClientIp } from '@/lib/client-ip'
import { sendVerificationEmail } from '@/lib/email'
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
import { readUserByEmailKey, registerUser } from '@/lib/soc-store-adapter'

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

    // ─── Phase 4.5: no auto-session on register ──────────────────────────
    // Previous Phase 3+4 behavior minted a soc_session cookie immediately
    // after registerUser succeeded — combined with the edge email-gate,
    // that meant the user "logged in but stuck on verify-pending." The
    // refactor removes session minting entirely from register: the
    // account is created in an unverified state, the verification email
    // is dispatched, and the client redirects to /auth/verify-pending.
    // The user must complete email verification, then log in via the
    // login form (which now enforces emailVerified before issuing a
    // session). This makes login the single source of truth for session
    // creation and removes the need for any edge-side gating.
    //
    // Fire verification email. Failures don't roll back the user — the
    // /verify/resend endpoint lets the operator request a new link.
    // We surface the failure as a `warning` so the client can show
    // a "couldn't send email" hint on the verify-pending screen.
    // Phase 6: delegated to sendVerificationEmail which renders via the
    // centralized email-templates module. Same dispatch behavior; the
    // body just lives in src/lib/email-templates.ts now so the
    // verification + reset emails share a header, footer, and brand
    // mark constant.
    const verifyUrl = `${appBaseUrl(request)}/verify?token=${encodeURIComponent(emailVerifyToken)}`
    const emailResultSend = await sendVerificationEmail({
      to: email,
      verifyUrl,
      username: user.displayName,
    })

    let warning: string | undefined
    if (!emailResultSend.ok) {
      console.warn('[auth/register] Verification email failed to send:', emailResultSend.error)
      warning = 'Verification email could not be sent. Please request a resend.'
    }

    return NextResponse.json({
      ok: true,
      message: 'Doğrulama maili gönderildi. Email kutunu kontrol et.',
      ...(warning ? { warning } : {}),
    })
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
