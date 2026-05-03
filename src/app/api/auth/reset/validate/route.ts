import { NextRequest, NextResponse } from 'next/server'
import { findUserByPasswordResetToken } from '@/lib/soc-store-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ValidationReason = 'expired' | 'invalid'

/**
 * GET /api/auth/reset/validate?token=...
 *
 * Pre-check used by the /reset page to decide which UI branch to
 * render before the user types a new password. Branches:
 *   - valid: true                            → render the reset form
 *   - valid: false, reason: 'expired'        → "expired, request again" UI
 *   - valid: false, reason: 'invalid'        → "invalid, request again" UI
 *
 * Always returns 200 — the validity is encoded in the body, not the
 * status code. This avoids treating "expired" and "invalid" as errors
 * (they're expected states) and matches the read-only nature of the
 * endpoint: a GET request that observes state without mutating it.
 *
 * Public endpoint. Read-only GET, so middleware skips both the CSRF
 * and session-presence checks. No rate limit at this layer — the
 * /api/auth/reset POST that consumes the token IS rate-limited
 * implicitly via the 1h token TTL (an attacker would have to guess a
 * 32-byte random hex within the window, which is computationally
 * infeasible).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''

  if (!token) {
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: 'invalid' satisfies ValidationReason,
    })
  }

  try {
    const user = await findUserByPasswordResetToken(token)
    if (!user) {
      return NextResponse.json({
        ok: true,
        valid: false,
        reason: 'invalid' satisfies ValidationReason,
      })
    }

    if (!user.passwordResetTokenExpiresAt) {
      // Token row exists but expiry was never set — treat as invalid.
      // This shouldn't happen in normal flow (setPasswordResetToken
      // always sets expiresAt) but defensively coercing to invalid is
      // safer than letting a never-expiring token through.
      return NextResponse.json({
        ok: true,
        valid: false,
        reason: 'invalid' satisfies ValidationReason,
      })
    }

    const expiresAt = Date.parse(user.passwordResetTokenExpiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json({
        ok: true,
        valid: false,
        reason: 'expired' satisfies ValidationReason,
      })
    }

    return NextResponse.json({ ok: true, valid: true })
  } catch (err) {
    console.error('[auth/reset/validate] failed:', err)
    // Treat unexpected internal failures as invalid — the user will
    // see the "request a new link" UI, which is the safest fallback
    // (vs. showing the form and failing on submit).
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: 'invalid' satisfies ValidationReason,
    })
  }
}
