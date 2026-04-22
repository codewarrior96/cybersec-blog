import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getRequestMetadata } from '@/lib/auth-server'
import { archiveReport, createReport, listReports } from '@/lib/soc-store-adapter'
import type { ReportStatus } from '@/lib/soc-types'

interface PostBody {
  title?: unknown
  content?: unknown
  severity?: unknown
  tags?: unknown
}

interface PatchBody {
  id?: unknown
  action?: unknown
}

const ALLOWED_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 50_000
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 40

function hasBrokenEncoding(value: string) {
  return value.includes('\uFFFD')
}

function parseReportStatus(value: string | null): ReportStatus | 'all' {
  if (value === 'archived' || value === 'all') return value
  return 'active'
}

function parseSeverity(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const upper = value.toUpperCase()
  return ALLOWED_SEVERITIES.has(upper) ? upper : null
}

function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.trunc(limitRaw))) : 20
  const cursor = parsePositiveInt(searchParams.get('cursor')) ?? undefined
  const status = parseReportStatus(searchParams.get('status'))

  const result = await listReports({ limit, cursor, status })
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as PostBody

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const severity = parseSeverity(body.severity) ?? 'LOW'
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[])
        .filter((item): item is string => typeof item === 'string')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH)
        .slice(0, MAX_TAGS)
    : []

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: `title max ${MAX_TITLE_LENGTH} karakter.` }, { status: 400 })
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `content max ${MAX_CONTENT_LENGTH} karakter.` }, { status: 400 })
  }

  if (body.severity !== undefined && parseSeverity(body.severity) === null) {
    return NextResponse.json(
      { error: 'severity LOW, MEDIUM, HIGH veya CRITICAL olmali.' },
      { status: 400 },
    )
  }

  if (hasBrokenEncoding(title) || hasBrokenEncoding(content) || tags.some(hasBrokenEncoding)) {
    return NextResponse.json(
      { error: 'Rapor metninde bozuk karakter algılandı. Lütfen içeriği yeniden oluşturun.' },
      { status: 400 },
    )
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

export async function PATCH(request: NextRequest) {
  const guard = await requireSession(request)
  if (guard.response) return guard.response
  if (!guard.session) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody
  const id = parsePositiveInt(body.id)
  const action = typeof body.action === 'string' ? body.action : ''

  if (id === null) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  if (action !== 'archive') {
    return NextResponse.json({ error: 'unsupported action' }, { status: 400 })
  }

  try {
    const report = await archiveReport(id, guard.session.user, getRequestMetadata(request))
    if (!report) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bu raporu arşivleme yetkiniz yok.' }, { status: 403 })
    }

    throw error
  }
}
