import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { getReservedUsernameError, isReservedUsername } from '@/lib/identity-rules'
import {
  getDisplayNameError,
  getPasswordError,
  getUsernameFormatError,
  isAllowedUsername,
  isValidDisplayName,
  isValidPassword,
} from '@/lib/identity-validation'
import { hashPassword } from '@/lib/security'
import { createUser, listAssignableUsers } from '@/lib/soc-store-adapter'
import type { UserRole } from '@/lib/soc-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: UserRole[] = ['admin', 'analyst', 'viewer']

export async function GET(request: NextRequest) {
  // R-API-06 closure (Wave 2B): GET previously required only an
  // authenticated session — any viewer-role user could enumerate all
  // admins + analysts via `listAssignableUsers`. Phase 3.A audit Section 2
  // flagged this as principle-of-least-privilege gap (Medium). Gate
  // now requires analyst+ (matches the alerts-write minimum role; viewer
  // accounts cannot enumerate). POST already uses requireRole('admin'),
  // so this brings GET in line with the route's authorization posture.
  // SENIOR ARCHITECT NOTE: 'analyst' (not 'admin') because the assignee-
  // picker UI feature legitimately needs analyst-level read access to
  // produce assignments; admin-only would block analyst workflows.
  // REJECTED ALTERNATIVE: per-row filter (return only same-team users).
  // Rejected — no team concept exists today; analyst-gate is the cleanest
  // closure within current data model.
  const guard = await requireRole(request, 'analyst')
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

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

  if (!isAllowedUsername(username)) {
    return NextResponse.json({ error: getUsernameFormatError() }, { status: 400 })
  }

  if (isReservedUsername(username)) {
    return NextResponse.json({ error: getReservedUsernameError() }, { status: 400 })
  }

  if (!isValidDisplayName(displayName)) {
    return NextResponse.json({ error: getDisplayNameError() }, { status: 400 })
  }

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: getPasswordError() }, { status: 400 })
  }

  try {
    await createUser({
      username,
      displayName,
      role,
      passwordHash: hashPassword(password),
      actor: guard.session.user,
      metadata: getRequestMetadata(request),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kullanici olusturulamadi.'
    if (message === 'User already exists') {
      return NextResponse.json({ error: 'Bu kullanici adi zaten kullaniliyor.' }, { status: 409 })
    }
    if (message === 'Reserved username') {
      return NextResponse.json({ error: getReservedUsernameError() }, { status: 400 })
    }
    throw error
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
