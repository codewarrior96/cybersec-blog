import { NextRequest, NextResponse } from 'next/server'
import { findUserByVerifyToken, setEmailVerified } from '@/lib/soc-store-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/verify?token=...
 *
 * Consumes a 24h-TTL emailVerifyToken (32-byte hex) issued at register
 * (Phase 3) or by /api/auth/verify/resend. On success, marks
 * emailVerified=true and clears the token.
 *
 * Distinct error codes for the /verify page UI to render accurate
 * messaging:
 *   - TOKEN_INVALID: token not found (already consumed, never existed,
 *     or doesn't match any user)
 *   - TOKEN_EXPIRED: token found but past its expiresAt
 *   - INTERNAL: store-level failure
 *
 * Public endpoint (allowlisted in middleware PUBLIC_API_ROUTES at
 * Phase 5 expansion would be needed if mutations were involved; this
 * is read-only GET so middleware skips both CSRF + session checks).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''

  if (!token) {
    return NextResponse.json({ ok: false, error: 'TOKEN_INVALID' }, { status: 400 })
  }

  try {
    const user = await findUserByVerifyToken(token)
    if (!user) {
      return NextResponse.json({ ok: false, error: 'TOKEN_INVALID' }, { status: 400 })
    }

    if (!user.emailVerifyTokenExpiresAt) {
      return NextResponse.json({ ok: false, error: 'TOKEN_INVALID' }, { status: 400 })
    }

    const expiresAt = Date.parse(user.emailVerifyTokenExpiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json({ ok: false, error: 'TOKEN_EXPIRED' }, { status: 400 })
    }

    const updated = await setEmailVerified(user.id)
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        email: updated.email,
        emailVerified: updated.emailVerified,
        role: updated.role,
      },
    })
  } catch (err) {
    console.error('[auth/verify] failed:', err)
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 })
  }
}
