import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { verifyPassword } from '@/lib/security'
import { deleteUserCascade } from '@/lib/soc-store-adapter'
import { readUserById } from '@/lib/soc-store-supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DELETE_CONFIRMATION = 'DELETE'

interface DeleteAccountBody {
  password?: unknown
  confirmation?: unknown
}

/**
 * F-002 — DELETE /api/users/me
 *
 * Permanently deletes the acting user's account + cascade resources
 * (sessions, reports, certifications + assets, educations, avatar
 * binaries, profile, indexes). Self-only — no admin path.
 *
 * Banking-grade safety:
 *   - Current password must verify (re-authentication)
 *   - confirmation field must equal literal "DELETE" (case-sensitive)
 *   - Both checked before cascade fires
 *
 * Discovery note: spec assumed bcryptjs but the codebase uses native
 * scrypt via verifyPassword from @/lib/security. The dep wasn't in
 * package.json — using the existing helper avoids the "no new
 * dependencies" hard ban and keeps the password contract identical
 * to login + reset.
 *
 * Status code map:
 *   200 — { deleted: true, counts: {...} } + cleared session cookie
 *   400 — missing password OR wrong confirmation literal
 *   401 — no session (source: 'route' tag, BUG-001 inheritance)
 *         OR password mismatch
 *   404 — session points to a user record that no longer exists
 *   500 — AUDIT_LOG_FAILED (cascade aborted, user intact) OR
 *         user-record deletion failure (partial cascade — orphans
 *         logged for sweep)
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.', source: 'route' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as DeleteAccountBody
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmation = typeof body.confirmation === 'string' ? body.confirmation : ''

  if (!password) {
    return NextResponse.json({ error: 'Şifre gerekli.' }, { status: 400 })
  }

  if (confirmation !== DELETE_CONFIRMATION) {
    return NextResponse.json(
      { error: `Onay alanına "${DELETE_CONFIRMATION}" yazmanız gerekiyor.` },
      { status: 400 },
    )
  }

  // Re-fetch the full StoredUser to access passwordHash. The session
  // payload is the public SessionUser shape and intentionally omits
  // the hash — readUserById is the controlled access path.
  const user = await readUserById(guard.session.user.id)
  if (!user) {
    return NextResponse.json({ error: 'Hesap bulunamadı.' }, { status: 404 })
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Şifre hatalı.' }, { status: 401 })
  }

  try {
    const result = await deleteUserCascade(
      guard.session.user.id,
      guard.session.user,
      getRequestMetadata(request),
    )

    if (!result) {
      return NextResponse.json({ error: 'Hesap silinemedi.' }, { status: 500 })
    }

    const response = NextResponse.json({
      deleted: true,
      counts: result.counts,
    })

    // Clear the session cookie. Server-side sessions are already wiped
    // via deleteAllSessionsForUser inside the cascade; this clears the
    // client-side cookie for clean state on the next request.
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'AUDIT_LOG_FAILED') {
      return NextResponse.json(
        { error: 'Denetim kaydı oluşturulamadı, hesap silme işlemi iptal edildi.' },
        { status: 500 },
      )
    }
    throw error
  }
}
