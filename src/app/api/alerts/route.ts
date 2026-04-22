import { NextRequest, NextResponse } from 'next/server'
import { requireRole, requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { createAlert, listAlerts } from '@/lib/soc-store-adapter'
import type { AlertPriority, AlertStatus } from '@/lib/soc-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES: AlertStatus[] = ['new', 'in_progress', 'blocked', 'resolved']
const PRIORITIES: AlertPriority[] = ['P1', 'P2', 'P3', 'P4']

function parseStatus(value: string | null): AlertStatus | undefined {
  if (!value) return undefined
  return (STATUSES as string[]).includes(value) ? (value as AlertStatus) : undefined
}

function parsePriority(value: string | null): AlertPriority | undefined {
  if (!value) return undefined
  return (PRIORITIES as string[]).includes(value) ? (value as AlertPriority) : undefined
}

const DEFAULT_LIMIT = 12
const MIN_LIMIT = 1
const MAX_LIMIT = 100

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined
  return n
}

export async function GET(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response

  const params = request.nextUrl.searchParams
  const status = parseStatus(params.get('status'))
  const priority = parsePriority(params.get('priority'))

  const rawLimit = Number(params.get('limit') ?? DEFAULT_LIMIT)
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(rawLimit)))
      : DEFAULT_LIMIT

  const cursor = parsePositiveInt(params.get('cursor'))

  const assigneeParam = params.get('assignee')
  const assignee =
    assigneeParam === 'me'
      ? 'me'
      : assigneeParam === 'unassigned'
        ? 'unassigned'
        : parsePositiveInt(assigneeParam)

  const result = await listAlerts({
    status,
    priority,
    limit,
    cursor,
    assignee,
    meUserId: guard.session?.user.id,
  })

  return NextResponse.json(result)
}

interface CreateAlertBody {
  title?: unknown
  description?: unknown
  priority?: unknown
  status?: unknown
  assigneeId?: unknown
  note?: unknown
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(request, 'analyst')
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => ({}))) as CreateAlertBody
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const priority = typeof body.priority === 'string' ? parsePriority(body.priority) : undefined
  const status = typeof body.status === 'string' ? parseStatus(body.status) : undefined
  const assigneeId =
    body.assigneeId == null ? undefined : Number.isFinite(Number(body.assigneeId)) ? Number(body.assigneeId) : undefined
  const note = typeof body.note === 'string' ? body.note : undefined

  if (!title || !description) {
    return NextResponse.json({ error: 'Baslik ve aciklama gerekli.' }, { status: 400 })
  }

  if (!priority) {
    return NextResponse.json({ error: 'Gecerli bir priority gerekli (P1-P4).' }, { status: 400 })
  }

  const created = await createAlert({
    title,
    description,
    priority,
    status,
    assigneeId,
    createdByUserId: guard.session?.user.id ?? null,
    note,
    metadata: getRequestMetadata(request),
  })

  return NextResponse.json({ alert: created }, { status: 201 })
}
