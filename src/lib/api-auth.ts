import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { hasRoleAtLeast } from '@/lib/auth-shared'
import { getServerSessionFromRequest } from '@/lib/auth-server'
import type { SessionRecord } from '@/lib/soc-store-adapter'
import type { UserRole } from '@/lib/soc-types'

export interface GuardResult {
  session: SessionRecord | null
  response: NextResponse | null
}

export async function requireSession(request: NextRequest): Promise<GuardResult> {
  const session = await getServerSessionFromRequest(request)
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }),
    }
  }

  return { session, response: null }
}

export async function requireRole(request: NextRequest, minimumRole: UserRole): Promise<GuardResult> {
  const guarded = await requireSession(request)
  if (!guarded.session) return guarded

  if (!hasRoleAtLeast(guarded.session.user.role, minimumRole)) {
    return {
      session: guarded.session,
      response: NextResponse.json({ error: 'Bu islem icin yetkiniz yok.' }, { status: 403 }),
    }
  }

  return { session: guarded.session, response: null }
}
