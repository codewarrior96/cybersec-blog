import { NextRequest, NextResponse } from 'next/server'
import {
  addComment,
  createPost,
  likePost,
  listPosts,
  type PostCategory,
  type PostDifficulty,
} from '@/lib/community-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: herkese açık gönderi listesi
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as PostCategory | null
  const difficulty = searchParams.get('difficulty') as PostDifficulty | null
  const sort = (searchParams.get('sort') ?? 'newest') as 'newest' | 'popular' | 'views'
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))

  const posts = listPosts({
    category: category ?? undefined,
    difficulty: difficulty ?? undefined,
    sort,
    limit,
  })

  return NextResponse.json({ posts, total: posts.length })
}

// POST: yeni gönderi veya mevcut gönderide etkileşim
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : 'create'

  if (action === 'like') {
    const id = typeof body.id === 'string' ? body.id : ''
    const userId = typeof body.userId === 'string' ? body.userId : 'anonymous'
    const post = likePost(id, userId)

    if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ post })
  }

  if (action === 'comment') {
    const id = typeof body.id === 'string' ? body.id : ''
    const author = typeof body.author === 'string' ? body.author.trim() : 'anonymous'
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const post = addComment(id, author, content)
    if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ post })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const author = typeof body.author === 'string' ? body.author.trim() : 'anonymous'
  const authorRole = typeof body.authorRole === 'string' ? body.authorRole.trim() : 'Community Member'
  const category = typeof body.category === 'string' ? (body.category as PostCategory) : 'GENERAL'
  const difficulty = typeof body.difficulty === 'string' ? (body.difficulty as PostDifficulty) : 'beginner'
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
    : []

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }

  const post = createPost({ author, authorRole, title, content, category, difficulty, tags })
  return NextResponse.json({ post }, { status: 201 })
}
