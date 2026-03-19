import { NextRequest, NextResponse } from 'next/server'

interface Report {
  id: number
  title: string
  content: string
  severity: string
  tags: string[]
  createdAt: string
}

interface PostBody {
  title?: unknown
  content?: unknown
  severity?: unknown
  tags?: unknown
}

interface DeleteBody {
  id?: unknown
}

// Module-level in-memory store — resets on redeploy, intentionally
const store: Report[] = []

export async function GET() {
  return NextResponse.json({ reports: [...store].reverse() })
}

export async function POST(request: NextRequest) {
  const body: PostBody = await request.json()

  const title    = typeof body.title    === 'string' ? body.title    : ''
  const content  = typeof body.content  === 'string' ? body.content  : ''
  const severity = typeof body.severity === 'string' ? body.severity : 'LOW'
  const tags     = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string')
    : []

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }

  const report: Report = {
    id: Date.now(),
    title,
    content,
    severity,
    tags,
    createdAt: new Date().toISOString(),
  }

  store.push(report)
  return NextResponse.json({ report }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const body: DeleteBody = await request.json()
  const id = typeof body.id === 'number' ? body.id : Number(body.id)

  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  const idx = store.findIndex(r => r.id === id)
  if (idx === -1) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  store.splice(idx, 1)
  return NextResponse.json({ ok: true })
}
