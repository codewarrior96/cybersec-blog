import { NextRequest, NextResponse } from 'next/server'
import { requireRole, requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { hashPassword } from '@/lib/security'
import { createUser, listAssignableUsers } from '@/lib/soc-store'
import type { UserRole } from '@/lib/soc-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: UserRole[] = ['admin', 'analyst', 'viewer']

export async function GET(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response

  const users = await listAssignableUsers()
  return NextResponse.json({ users })
}

interface CreateUserBody {
  username?: unknown
  displayName?: unknown
  password?: unknown
  role?: unknown
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(request, 'admin')
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as CreateUserBody
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = typeof body.role === 'string' && (ROLES as string[]).includes(body.role) ? (body.role as UserRole) : null

  if (!username || !displayName || !password || !role) {
    return NextResponse.json({ error: 'username, displayName, password ve role zorunlu.' }, { status: 400 })
  }

  await createUser({
    username,
    displayName,
    role,
    passwordHash: hashPassword(password),
    actor: guard.session.user,
    metadata: getRequestMetadata(request),
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
