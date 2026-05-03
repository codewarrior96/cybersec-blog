import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { deleteReport } from '@/lib/soc-store-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }> | { id: string }
}

/**
 * F-001 — DELETE /api/reports/[id]
 *
 * Permanently removes an archived report. Two-stage safety enforced
 * server-side: returns 409 NOT_ARCHIVED if the target report is still
 * active. The UI hides the button on active reports as a UX layer,
 * but the server is the source of truth.
 *
 * Status code map:
 *   200 — { ok: true, id }
 *   400 — invalid id
 *   401 — no session (source: 'route' tag — BUG-001 observability)
 *   403 — FORBIDDEN (viewer trying to delete someone else's report)
 *   404 — report not found
 *   409 — NOT_ARCHIVED (active report — must archive first)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.', source: 'route' }, { status: 401 })
  }

  const params = await Promise.resolve(context.params)
  const idNum = Number(params.id)
  if (!Number.isFinite(idNum) || !Number.isInteger(idNum) || idNum <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  try {
    const result = await deleteReport(idNum, guard.session.user, getRequestMetadata(request))
    if (!result) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, id: idNum })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Bu raporu silme yetkiniz yok.' }, { status: 403 })
      }
      if (error.message === 'NOT_ARCHIVED') {
        return NextResponse.json(
          { error: 'Yalnızca arşivlenmiş raporlar kalıcı silinebilir. Önce raporu arşivleyin.' },
          { status: 409 },
        )
      }
    }
    throw error
  }
}
