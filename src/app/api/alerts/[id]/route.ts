import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { patchAlert } from '@/lib/soc-store'
import type { AlertPriority, AlertStatus } from '@/lib/soc-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES: AlertStatus[] = ['new', 'in_progress', 'blocked', 'resolved']
const PRIORITIES: AlertPriority[] = ['P1', 'P2', 'P3', 'P4']

interface PatchBody {
  status?: unknown
  priority?: unknown
  assigneeId?: unknown
  note?: unknown
  claim?: unknown
  resolve?: unknown
}

function parseStatus(value: unknown): AlertStatus | undefined {
  if (typeof value !== 'string') return undefined
  return (STATUSES as string[]).includes(value) ? (value as AlertStatus) : undefined
}

function parsePriority(value: unknown): AlertPriority | undefined {
  if (typeof value !== 'string') return undefined
  return (PRIORITIES as string[]).includes(value) ? (value as AlertPriority) : undefined
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireRole(request, 'analyst')
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const alertId = Number(params.id)
  if (!Number.isFinite(alertId) || alertId <= 0) {
    return NextResponse.json({ error: 'Gecersiz alert id.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody
  const status = parseStatus(body.status)
  const priority = parsePriority(body.priority)
  const assigneeId =
    typeof body.assigneeId === 'undefined'
      ? undefined
      : body.assigneeId === null
        ? null
        : Number.isFinite(Number(body.assigneeId))
          ? Number(body.assigneeId)
          : undefined
  const note = typeof body.note === 'string' ? body.note : undefined
  const claim = body.claim === true
  const resolve = body.resolve === true

  const updated = await patchAlert(
    alertId,
    {
      status,
      priority,
      assigneeId,
      note,
      claim,
      resolve,
    },
    guard.session.user,
    getRequestMetadata(request),
  )

  if (!updated) {
    return NextResponse.json({ error: 'Alert bulunamadi.' }, { status: 404 })
  }

  return NextResponse.json({ alert: updated })
}
