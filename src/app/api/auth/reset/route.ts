import { NextRequest, NextResponse } from 'next/server'
import { getPasswordError, isValidPassword } from '@/lib/identity-validation'
import { checkRateLimit, recordFailure } from '@/lib/rate-limiter'
import { hashPassword } from '@/lib/security'
import {
  consumePasswordResetToken,
  deleteAllSessionsForUser,
  findUserByPasswordResetToken,
  writeAuditLog,
} from '@/lib/soc-store-adapter'
import { getRequestMetadata } from '@/lib/auth-server'
import { getClientIp } from '@/lib/client-ip'

interface ResetBody {
  token?: unknown
  newPassword?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Per-IP rate limit on the consume endpoint. Token guessing is
// computationally infeasible (32-byte random hex), but a leaked log
// line or shoulder-surf could land an attacker a valid token; the rate
// limit here caps damage from those long-tail leak vectors.
const RESET_RATE_LIMIT = {
  bucket: 'auth.reset',
  max: 10,
  windowMs: 5 * 60 * 1000,
} as const

const MAX_TOKEN_LENGTH = 256

/**
 * POST /api/auth/reset
 *
 * Body: { token: string, newPassword: string }
 *
 * Consumes a password-reset token issued by /api/auth/forgot. On
 * success:
 *   1. Hashes the new password (scrypt + 16-byte salt, same as
 *      register)
 *   2. Atomically writes passwordHash + clears reset token via
 *      consumePasswordResetToken
 *   3. Invalidates ALL active sessions for the user (every device
 *      logged out)
 *   4. Returns 200 with a "now login fresh" message
 *
 * Distinct error codes for the /reset page UI:
 *   - TOKEN_INVALID: token not found (already consumed, never existed)
 *   - TOKEN_EXPIRED: token found but past 1h TTL
 *   - WEAK_PASSWORD: new password fails identity-validation rules
 *   - INTERNAL: store-level failure
 *
 * Public endpoint. CSRF enforced by middleware (Origin check).
 * Session-presence bypassed via PUBLIC_API_ROUTES — by definition
 * the user has no session when consuming a reset token.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  const rate = checkRateLimit(ip, RESET_RATE_LIMIT)
  if (rate.limited) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMITED', message: 'Çok fazla deneme. Birkaç dakika sonra tekrar dene.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    )
  }

  const body = (await request.json().catch(() => ({}))) as ResetBody
  const token = typeof body.token === 'string' ? body.token : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    recordFailure(ip, RESET_RATE_LIMIT)
    return NextResponse.json(
      { ok: false, error: 'TOKEN_INVALID', message: 'Geçersiz bağlantı. Yeniden talep et.' },
      { status: 400 },
    )
  }

  // Validate password format BEFORE hashing — scrypt is intentionally
  // expensive and we don't want attackers triggering it on every
  // junk-password attempt.
  if (!isValidPassword(newPassword)) {
    recordFailure(ip, RESET_RATE_LIMIT)
    return NextResponse.json(
      { ok: false, error: 'WEAK_PASSWORD', message: getPasswordError() },
      { status: 400 },
    )
  }

  try {
    const user = await findUserByPasswordResetToken(token)
    if (!user) {
      recordFailure(ip, RESET_RATE_LIMIT)
      return NextResponse.json(
        { ok: false, error: 'TOKEN_INVALID', message: 'Geçersiz bağlantı. Yeniden talep et.' },
        { status: 400 },
      )
    }

    if (!user.passwordResetTokenExpiresAt) {
      recordFailure(ip, RESET_RATE_LIMIT)
      return NextResponse.json(
        { ok: false, error: 'TOKEN_INVALID', message: 'Geçersiz bağlantı. Yeniden talep et.' },
        { status: 400 },
      )
    }

    const expiresAt = Date.parse(user.passwordResetTokenExpiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      recordFailure(ip, RESET_RATE_LIMIT)
      return NextResponse.json(
        { ok: false, error: 'TOKEN_EXPIRED', message: 'Bu bağlantı süresi dolmuş. Yeni bir bağlantı talep et.' },
        { status: 400 },
      )
    }

    // Atomic password update: writes new hash + clears token + bumps
    // updatedAt in one writeUser call. The token is single-use because
    // the next findUserByPasswordResetToken(token) returns null.
    const hashed = hashPassword(newPassword)
    const updated = await consumePasswordResetToken(user.id, hashed)
    if (!updated) {
      console.error('[auth/reset] consumePasswordResetToken returned null for', user.id)
      return NextResponse.json(
        { ok: false, error: 'INTERNAL', message: 'Şifre sıfırlama servisi şu anda kullanılamıyor.' },
        { status: 500 },
      )
    }

    // Session invalidation. Standard GitHub/banking pattern: a "forgot
    // password" event is treated as a potential compromise signal, so
    // every active session for the user is killed. Best-effort —
    // listing failures are logged inside deleteAllSessionsForUser and
    // surfaced via deletedCount, but we don't roll back the password
    // update on partial-delete (the new password is the source of
    // truth; stale sessions will fail on next request anyway because
    // the user record's lookup will succeed but the embedded session
    // user.id no longer matches an authenticated context).
    const sessionResult = await deleteAllSessionsForUser(updated.id)

    const metadata = getRequestMetadata(request)
    await writeAuditLog({
      actorUserId: updated.id,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: updated.id,
      details: {
        sessionsInvalidated: sessionResult.deletedCount,
      },
      metadata,
    }).catch((err) => {
      console.warn('[auth/reset] audit log failed:', err)
    })

    return NextResponse.json({
      ok: true,
      message: 'Şifren güncellendi. Şimdi yeni şifrenle giriş yap.',
    })
  } catch (err) {
    console.error('[auth/reset] failed:', err)
    return NextResponse.json(
      { ok: false, error: 'INTERNAL', message: 'Şifre sıfırlama servisi şu anda kullanılamıyor.' },
      { status: 500 },
    )
  }
}
