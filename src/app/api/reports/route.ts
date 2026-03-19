import { NextRequest, NextResponse } from 'next/server'
import { requireRole, requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { createReport, deleteReport, listReports } from '@/lib/soc-store-adapter'

interface PostBody {
  title?: unknown
  content?: unknown
  severity?: unknown
  tags?: unknown
}

interface DeleteBody {
  id?: unknown
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
  const cursorParam = searchParams.get('cursor')
  const cursor = cursorParam != null ? Number(cursorParam) : undefined

  const result = await listReports({ limit, cursor })
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(request, 'analyst')
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as PostBody

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const severity = typeof body.severity === 'string' ? body.severity : 'LOW'
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((item): item is string => typeof item === 'string')
    : []

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }

  const report = await createReport({
    title,
    content,
    severity,
    tags,
    actor: guard.session.user,
    metadata: getRequestMetadata(request),
  })

  return NextResponse.json({ report }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const guard = await requireRole(request, 'analyst')
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as DeleteBody
  const id = typeof body.id === 'number' ? body.id : Number(body.id)

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  const deleted = await deleteReport(id, guard.session.user, getRequestMetadata(request))
  if (!deleted) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
