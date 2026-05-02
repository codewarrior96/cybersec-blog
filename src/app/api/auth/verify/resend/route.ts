import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
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

function buildVerificationEmail(displayName: string, verifyUrl: string) {
  const safeName = displayName || 'Operator'
  const subject = 'BREACH LAB — Email adresini doğrula'
  const text = [
    `Merhaba ${safeName},`,
    '',
    'BREACH LAB için yeni bir doğrulama bağlantısı talep ettin. Email adresini doğrulamak için aşağıdaki bağlantıya tıkla:',
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
<h1 style="color:#f8fafc;font-size:18px;margin:0 0 12px;">Yeni doğrulama bağlantısı</h1>
<p style="line-height:1.6;color:#cbd5e1;font-size:13px;">Merhaba ${safeName}, BREACH LAB için yeni bir doğrulama bağlantısı talep ettin. Aşağıdaki bağlantıya tıkla:</p>
<p style="margin:16px 0;"><a href="${verifyUrl}" style="display:inline-block;background:#00ff41;color:#000;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none;">Email adresini doğrula</a></p>
<p style="font-size:11px;color:#94a3b8;line-height:1.6;">Bağlantı 24 saat geçerli. Çalışmıyorsa şu URL'yi tarayıcına yapıştırabilirsin:<br/><span style="color:#00ff41;word-break:break-all;">${verifyUrl}</span></p>
<p style="font-size:10px;color:#64748b;margin-top:24px;">Sen istemediysen bu maili görmezden gelebilirsin.</p>
</div></body></html>`
  return { subject, html, text }
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

    const verifyUrl = `${appBaseUrl(request)}/verify?token=${encodeURIComponent(token)}`
    const content = buildVerificationEmail(updated.displayName, verifyUrl)
    const sendResult = await sendEmail({
      to: updated.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
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
