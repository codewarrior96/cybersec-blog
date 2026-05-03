import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/email'
import { validateEmail } from '@/lib/identity-validation'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { readUserByEmailKey, setEmailVerifyToken } from '@/lib/soc-store-adapter'

interface ResendBody {
  email?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESEND_RATE_LIMIT = {
  bucket: 'auth.verify.resend',
  max: 3,
  windowMs: 60 * 60 * 1000,
} as const

const VERIFY_TOKEN_BYTES = 32
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const GENERIC_OK = 'Eger email kayitliysa, yeni dogrulama bagi gonderildi.'

function appBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return `${request.nextUrl.protocol}//${request.nextUrl.host}`
}

/**
 * POST /api/auth/verify/resend
 *
 * Body: { email: string }
 *
 * Generates a fresh emailVerifyToken (32-byte hex, 24h TTL) for the
 * matching account if one exists AND emailVerified is still false,
 * then dispatches a new verification email via the Phase 1 helper.
 *
 * Always returns the same generic 200 success ("if email is registered,
 * link sent") regardless of whether the address exists or is already
 * verified — prevents enumeration. Rate-limited per email bucket
 * (3/hour), keyed off the trimmed+lowercased emailKey so the limit
 * applies regardless of capitalization variants.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ResendBody
  const emailRaw = typeof body.email === 'string' ? body.email : ''

  // Format check first — invalid format = 400 before we waste limiter slots.
  // Generic message preserves the no-enumeration property: a malformed input
  // is its own class of error, not "this email doesn't exist".
  const emailResult = validateEmail(emailRaw)
  if (!emailResult.ok) {
    return NextResponse.json({ ok: false, error: 'INVALID_EMAIL' }, { status: 400 })
  }
  const emailKey = emailResult.value

  // Rate limit by emailKey (not IP) — per spec "3 attempts per email per
  // hour". A real attacker could rotate IPs but rotating emails is
  // pointless (they'd have to control each address).
  const rate = checkRateLimit(emailKey, RESEND_RATE_LIMIT)
  if (rate.limited) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    )
  }
  // Count this attempt regardless of outcome so abuse can't iterate.
  recordFailure(emailKey, RESEND_RATE_LIMIT)

  try {
    const user = await readUserByEmailKey(emailKey)
    if (!user || !user.isActive || user.emailVerified) {
      // Generic success — no signal about which condition matched.
      return NextResponse.json({ ok: true, message: GENERIC_OK })
    }

    const token = randomBytes(VERIFY_TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString()
    const updated = await setEmailVerifyToken(user.id, token, expiresAt)
    if (!updated) {
      // Treat as success externally; log internally for debugging.
      console.warn('[auth/verify/resend] setEmailVerifyToken returned null for', emailKey)
      return NextResponse.json({ ok: true, message: GENERIC_OK })
    }

    // Phase 6: dispatched via sendVerificationEmail / email-templates
    // module — same content as register, just a different trigger
    // (user requested a fresh link rather than initial signup).
    const verifyUrl = `${appBaseUrl(request)}/verify?token=${encodeURIComponent(token)}`
    const sendResult = await sendVerificationEmail({
      to: updated.email,
      verifyUrl,
      username: updated.displayName,
    })

    if (!sendResult.ok) {
      console.warn('[auth/verify/resend] sendEmail failed:', sendResult.error)
    }

    // Same generic response either way — operator sees "check inbox"
    // regardless of whether the email actually went out.
    return NextResponse.json({ ok: true, message: GENERIC_OK })
  } catch (err) {
    console.error('[auth/verify/resend] failed:', err)
    return NextResponse.json({ ok: true, message: GENERIC_OK })
  }
}
