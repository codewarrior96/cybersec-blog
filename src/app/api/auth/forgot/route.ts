import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/email'
import { validateEmail } from '@/lib/identity-validation'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { readUserByEmailKey, setPasswordResetToken } from '@/lib/soc-store-adapter'

interface ForgotBody {
  email?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORGOT_RATE_LIMIT = {
  bucket: 'auth.forgot',
  max: 3,
  windowMs: 60 * 60 * 1000,
} as const

const RESET_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour — shorter than the
// 24h verify token because reset is more sensitive (a compromised reset
// link grants the attacker a password, vs. the verify link which only
// flips emailVerified).

const GENERIC_OK = 'Eğer bu email kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.'

function appBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return `${request.nextUrl.protocol}//${request.nextUrl.host}`
}

/**
 * POST /api/auth/forgot
 *
 * Body: { email: string }
 *
 * Always returns 200 with the same generic message regardless of
 * whether the email is registered or its emailVerified state. This
 * prevents email enumeration: an attacker probing the endpoint cannot
 * distinguish "this email exists" from "this email doesn't exist" or
 * "this email exists but isn't verified."
 *
 * Internally:
 *   - If the account exists AND emailVerified=true: generate a
 *     32-byte hex reset token (1h TTL), persist it via
 *     setPasswordResetToken, and dispatch the reset email.
 *   - If the account doesn't exist OR emailVerified=false: do
 *     nothing (no email, no DB write).
 *
 * Email send failures are logged internally but do not change the
 * response shape — the user still sees the generic "if registered,
 * link sent" message. This is intentional: surfacing send failures
 * would re-introduce the enumeration channel ("the email exists but
 * Resend rate-limited me" reveals that the email exists).
 *
 * Rate-limited per emailKey at 3 requests / hour. IP-based rate
 * limiting would let an attacker targeting one specific email rotate
 * IPs to bypass it; emailKey-based limiting works because controlling
 * many email addresses is the prerequisite for abuse, and we don't
 * leak which addresses are real anyway.
 *
 * CSRF: enforced by middleware (Origin/Referer must match host).
 * Session-presence: bypassed via PUBLIC_API_ROUTES — by definition
 * the user has no session when they're recovering a forgotten
 * password.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ForgotBody
  const emailRaw = typeof body.email === 'string' ? body.email : ''

  // Format check first — invalid format = 400 before we waste limiter
  // slots. Same generic-error pattern as /verify/resend: a malformed
  // input is its own error class, not a "this email doesn't exist"
  // signal, so the 400 is safe to return.
  const emailResult = validateEmail(emailRaw)
  if (!emailResult.ok) {
    return NextResponse.json({ ok: false, error: 'INVALID_EMAIL' }, { status: 400 })
  }
  const emailKey = emailResult.value

  const rate = checkRateLimit(emailKey, FORGOT_RATE_LIMIT)
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
  recordFailure(emailKey, FORGOT_RATE_LIMIT)

  try {
    const user = await readUserByEmailKey(emailKey)

    // Silently skip if the user doesn't exist, is disabled, or hasn't
    // verified their email. The response is identical to the success
    // path — anti-enumeration. We log internally so we can debug
    // legitimate "user reports they didn't get the mail" complaints.
    if (!user || !user.isActive || !user.emailVerified) {
      return NextResponse.json({ ok: true, message: GENERIC_OK })
    }

    const token = randomBytes(RESET_TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString()
    const updated = await setPasswordResetToken(user.id, token, expiresAt)
    if (!updated) {
      console.warn('[auth/forgot] setPasswordResetToken returned null for', emailKey)
      return NextResponse.json({ ok: true, message: GENERIC_OK })
    }

    const resetUrl = `${appBaseUrl(request)}/reset?token=${encodeURIComponent(token)}`
    const sendResult = await sendPasswordResetEmail({
      to: updated.email,
      resetUrl,
      username: updated.displayName || updated.username,
    })

    if (!sendResult.ok) {
      console.warn('[auth/forgot] sendPasswordResetEmail failed:', sendResult.error)
    }

    return NextResponse.json({ ok: true, message: GENERIC_OK })
  } catch (err) {
    console.error('[auth/forgot] failed:', err)
    // Even on internal failure: generic 200 to preserve the
    // anti-enumeration property. The user can re-submit; the next
    // attempt will hit the rate limit if abuse is in progress.
    return NextResponse.json({ ok: true, message: GENERIC_OK })
  }
}
