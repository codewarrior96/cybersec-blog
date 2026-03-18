'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
  likes: string[]
}

interface CommunityPost {
  id: string
  author: string
  authorRole: string
  title: string
  content: string
  category: 'CTF' | 'WEB' | 'PENTEST' | 'MALWARE' | 'OSINT' | 'NETWORK' | 'GENERAL'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  likes: string[]
  comments: Comment[]
  createdAt: string
  views: number
}

type CategoryType = CommunityPost['category'] | 'ALL'
type DifficultyType = CommunityPost['difficulty'] | 'ALL'
type SortType = 'newest' | 'popular' | 'views'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'community_posts'

const CATEGORY_COLORS: Record<CommunityPost['category'], string> = {
  CTF: '#00ff41',
  WEB: '#3b82f6',
  PENTEST: '#f59e0b',
  MALWARE: '#ef4444',
  OSINT: '#8b5cf6',
  NETWORK: '#06b6d4',
  GENERAL: 'rgba(100,116,139,1)',
}

const DIFFICULTY_COLORS: Record<CommunityPost['difficulty'], string> = {
  beginner: '#00ff41',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
}

const SEED_POSTS: CommunityPost[] = [
  {
    id: 'seed1',
    author: 'ghost',
    authorRole: 'Security Researcher',
    title: 'SQL Injection ile Admin Panel Bypass',
    content:
      "Bu writeup'ta gerçek bir bug bounty programında bulduğum SQL injection açığını anlatacağım. Hedef site login formunda parameterized query kullanmıyordu...",
    category: 'WEB',
    difficulty: 'intermediate',
    tags: ['sql', 'bypass', 'bugbounty'],
    likes: ['user1', 'user2', 'user3'],
    comments: [
      {
        id: 'c1',
        author: 'user1',
        content: 'Harika writeup, özellikle UNION based kısmı çok açıklayıcı!',
        createdAt: new Date().toISOString(),
        likes: [],
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    views: 142,
  },
  {
    id: 'seed2',
    author: 'ghost',
    authorRole: 'Security Researcher',
    title: 'Linux Privilege Escalation: SUID Binaries',
    content:
      "CTF çözümünde karşılaştığım ilginç bir privesc vektörü. SUID bit'i aktif olan custom binary üzerinden root shell aldım...",
    category: 'PENTEST',
    difficulty: 'advanced',
    tags: ['linux', 'privesc', 'ctf'],
    likes: ['user2'],
    comments: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    views: 89,
  },
  {
    id: 'seed3',
    author: 'ghost',
    authorRole: 'Security Researcher',
    title: 'Wireshark ile Şifreli Trafik Analizi',
    content:
      'TLS trafiğini Wireshark ile nasıl analiz edebiliriz? Bu yazıda pre-master secret log dosyası kullanarak şifrelenmiş HTTPS trafiğini çözümlemeyi göstereceğim...',
    category: 'NETWORK',
    difficulty: 'beginner',
    tags: ['wireshark', 'network', 'tls'],
    likes: [],
    comments: [],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    views: 203,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes}d önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}sa önce`
  const days = Math.floor(hours / 24)
  return `${days} gün önce`
}

function loadPosts(): CommunityPost[] {
  if (typeof window === 'undefined') return SEED_POSTS
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_POSTS))
    return SEED_POSTS
  }
  return JSON.parse(raw) as CommunityPost[]
}

function savePosts(posts: CommunityPost[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkullAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid rgba(0,255,65,0.3)',
        background: 'black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 100 120"
        fill="#00ff41"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z" />
      </svg>
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? '#ef4444' : 'none'}
      stroke={filled ? '#ef4444' : 'currentColor'}
      strokeWidth="2"
      style={{ width: 16, height: 16 }}
    >
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  isLoggedIn,
  onLike,
  onClick,
}: {
  post: CommunityPost
  isLoggedIn: boolean
  onLike: (id: string) => void
  onClick: (post: CommunityPost) => void
}) {
  const [hovered, setHovered] = useState(false)
  const liked = post.likes.includes('ghost')
  const preview =
    post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content

  return (
    <div
      onClick={() => onClick(post)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: hovered ? '1px solid rgba(0,255,65,0.3)' : '1px solid rgba(255,255,255,0.06)',
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'all 300ms',
        boxShadow: hovered ? '0 0 20px rgba(0,255,65,0.05)' : 'none',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: 'rgba(0,255,65,0.03)',
          borderBottom: '1px solid rgba(0,255,65,0.06)',
          padding: '6px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontFamily: 'monospace',
            color: CATEGORY_COLORS[post.category],
            border: `1px solid ${CATEGORY_COLORS[post.category]}40`,
            padding: '2px 8px',
          }}
        >
          [{post.category}]
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: DIFFICULTY_COLORS[post.difficulty],
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                color: DIFFICULTY_COLORS[post.difficulty],
              }}
            >
              {post.difficulty.toUpperCase()}
            </span>
          </span>
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(100,116,139,0.4)' }}>
            {post.views} görüntüleme
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px' }}>
        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <SkullAvatar size={24} />
          <span style={{ color: '#00ff41', fontSize: 11, fontFamily: 'monospace' }}>
            {post.author}
          </span>
          <span style={{ color: 'rgba(0,255,65,0.3)', fontSize: 8, fontFamily: 'monospace' }}>
            [ SECURITY RESEARCHER ]
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ color: 'rgba(100,116,139,0.4)', fontSize: 8, fontFamily: 'monospace' }}>
            {timeAgo(post.createdAt)}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            color: hovered ? '#00ff41' : 'rgba(255,255,255,0.9)',
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 6,
            fontFamily: 'monospace',
            transition: 'color 200ms',
          }}
        >
          {post.title}
        </div>

        {/* Preview */}
        <div
          style={{
            color: 'rgba(100,116,139,0.6)',
            fontSize: 11,
            lineHeight: 1.6,
            fontFamily: 'monospace',
          }}
        >
          {preview}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {post.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 8,
                color: 'rgba(0,255,65,0.4)',
                border: '1px solid rgba(0,255,65,0.15)',
                padding: '2px 6px',
                fontFamily: 'monospace',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.04)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!isLoggedIn) {
              alert('Beğenmek için giriş yapmalısınız')
              return
            }
            onLike(post.id)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: liked ? '#ef4444' : 'rgba(100,116,139,0.4)',
            fontFamily: 'monospace',
            fontSize: 10,
          }}
        >
          <HeartIcon filled={liked} />
          {post.likes.length}
        </button>

        {/* Comments */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'rgba(100,116,139,0.4)',
            fontFamily: 'monospace',
            fontSize: 10,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ width: 14, height: 14 }}
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {post.comments.length}
        </div>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            fontFamily: 'monospace',
            color: hovered ? '#00ff41' : 'rgba(0,255,65,0.4)',
            transition: 'color 200ms',
          }}
        >
          DETAY →
        </span>
      </div>
    </div>
  )
}

// ─── Post Detail Modal ────────────────────────────────────────────────────────

function PostDetailModal({
  post,
  isLoggedIn,
  onClose,
  onLike,
  onLikeComment,
  onAddComment,
}: {
  post: CommunityPost
  isLoggedIn: boolean
  onClose: () => void
  onLike: (id: string) => void
  onLikeComment: (postId: string, commentId: string) => void
  onAddComment: (postId: string, content: string) => void
}) {
  const [commentText, setCommentText] = useState('')
  const liked = post.likes.includes('ghost')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(0,255,65,0.15)',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '10px 14px',
    outline: 'none',
    transition: 'all 200ms',
    boxSizing: 'border-box',
    resize: 'vertical' as const,
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 768,
          width: '100%',
          margin: '0 16px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#050508',
          border: '1px solid rgba(0,255,65,0.2)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'rgba(0,255,65,0.03)',
            borderBottom: '1px solid rgba(0,255,65,0.06)',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                color: CATEGORY_COLORS[post.category],
                border: `1px solid ${CATEGORY_COLORS[post.category]}40`,
                padding: '2px 8px',
              }}
            >
              [{post.category}]
            </span>
            <span
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                color: DIFFICULTY_COLORS[post.difficulty],
              }}
            >
              {post.difficulty.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(0,255,65,0.4)',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            [ X ]
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <SkullAvatar size={28} />
            <span style={{ color: '#00ff41', fontSize: 11, fontFamily: 'monospace' }}>
              {post.author}
            </span>
            <span style={{ color: 'rgba(0,255,65,0.3)', fontSize: 8, fontFamily: 'monospace' }}>
              [ SECURITY RESEARCHER ]
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ color: 'rgba(100,116,139,0.4)', fontSize: 8, fontFamily: 'monospace' }}>
              {timeAgo(post.createdAt)}
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 16,
              fontFamily: 'monospace',
            }}
          >
            {post.title}
          </div>

          {/* Content */}
          <div
            style={{
              color: 'rgba(200,200,200,0.8)',
              fontSize: 13,
              lineHeight: 1.8,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              marginBottom: 16,
            }}
          >
            {post.content}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
            {post.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 8,
                  color: 'rgba(0,255,65,0.4)',
                  border: '1px solid rgba(0,255,65,0.15)',
                  padding: '2px 6px',
                  fontFamily: 'monospace',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Like + Share */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingBottom: 20,
              borderBottom: '1px solid rgba(0,255,65,0.1)',
              marginBottom: 20,
            }}
          >
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  alert('Beğenmek için giriş yapmalısınız')
                  return
                }
                onLike(post.id)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: liked ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.4)',
                border: liked ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: liked ? '#ef4444' : 'rgba(100,116,139,0.6)',
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <HeartIcon filled={liked} />
              {post.likes.length} Beğeni
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href + '?post=' + post.id)
                alert('Link kopyalandı!')
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(100,116,139,0.6)',
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              [ PAYLAŞ ]
            </button>
          </div>

          {/* Comments */}
          <div
            style={{
              color: '#00ff41',
              fontSize: 12,
              fontFamily: 'monospace',
              borderBottom: '1px solid rgba(0,255,65,0.1)',
              paddingBottom: 8,
              marginBottom: 16,
            }}
          >
            // yorumlar ({post.comments.length})
          </div>

          {post.comments.map((comment) => {
            const commentLiked = comment.likes.includes('ghost')
            return (
              <div
                key={comment.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <SkullAvatar size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#00ff41', fontSize: 11, fontFamily: 'monospace' }}>
                      {comment.author}
                    </span>
                    <span
                      style={{ color: 'rgba(100,116,139,0.4)', fontSize: 8, fontFamily: 'monospace' }}
                    >
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'rgba(200,200,200,0.7)',
                      lineHeight: 1.6,
                      fontFamily: 'monospace',
                      marginBottom: 6,
                    }}
                  >
                    {comment.content}
                  </div>
                  <button
                    onClick={() => {
                      if (!isLoggedIn) return
                      onLikeComment(post.id, comment.id)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      color: commentLiked ? '#ef4444' : 'rgba(100,116,139,0.4)',
                      fontFamily: 'monospace',
                      fontSize: 9,
                      cursor: 'pointer',
                    }}
                  >
                    <HeartIcon filled={commentLiked} />
                    {comment.likes.length}
                  </button>
                </div>
              </div>
            )
          })}

          {post.comments.length === 0 && (
            <div
              style={{
                color: 'rgba(100,116,139,0.3)',
                fontSize: 11,
                fontFamily: 'monospace',
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              // henüz yorum yok — ilk yorumu sen yaz
            </div>
          )}

          {/* Add comment */}
          {isLoggedIn && (
            <div style={{ marginTop: 20 }}>
              <textarea
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Yorumunu yaz..."
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.5)'
                  e.target.style.boxShadow = '0 0 10px rgba(0,255,65,0.08)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.15)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <button
                onClick={() => {
                  if (!commentText.trim()) return
                  onAddComment(post.id, commentText.trim())
                  setCommentText('')
                }}
                style={{
                  marginTop: 8,
                  padding: '8px 20px',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  background: 'rgba(0,255,65,0.1)',
                  border: '1px solid rgba(0,255,65,0.5)',
                  color: '#00ff41',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,255,65,0.2)'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,65,0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0,255,65,0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                [ YORUM EKLE ]
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── New Post Form Modal ──────────────────────────────────────────────────────

function NewPostForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (post: CommunityPost) => void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CommunityPost['category']>('GENERAL')
  const [difficulty, setDifficulty] = useState<CommunityPost['difficulty']>('beginner')
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(0,255,65,0.15)',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '10px 14px',
    outline: 'none',
    transition: 'all 200ms',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    color: 'rgba(0,255,65,0.5)',
    fontSize: 9,
    fontFamily: 'monospace',
    marginBottom: 6,
    display: 'block',
  }

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return
    const newPost: CommunityPost = {
      id: Date.now().toString(),
      author: 'ghost',
      authorRole: 'Security Researcher',
      title: title.trim(),
      content: content.trim(),
      category,
      difficulty,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
      views: 0,
    }
    onSubmit(newPost)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 672,
          width: '100%',
          margin: '0 16px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#050508',
          border: '1px solid rgba(0,255,65,0.25)',
          padding: 24,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span
            style={{
              color: '#00ff41',
              fontSize: 14,
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            [ YENİ POST OLUŞTUR ]
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(0,255,65,0.4)',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            [ X ]
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>BAŞLIK:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.5)'
              e.target.style.boxShadow = '0 0 10px rgba(0,255,65,0.08)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.15)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>KATEGORİ:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CommunityPost['category'])}
            style={{ ...inputStyle, appearance: 'none' as const }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.5)'
              e.target.style.boxShadow = '0 0 10px rgba(0,255,65,0.08)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.15)'
              e.target.style.boxShadow = 'none'
            }}
          >
            {(['CTF', 'WEB', 'PENTEST', 'MALWARE', 'OSINT', 'NETWORK', 'GENERAL'] as const).map(
              (cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              )
            )}
          </select>
        </div>

        {/* Difficulty */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>ZORLUK SEVİYESİ:</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: '6px 14px',
                  fontFamily: 'monospace',
                  fontSize: 9,
                  cursor: 'pointer',
                  background:
                    difficulty === d
                      ? `${DIFFICULTY_COLORS[d]}18`
                      : 'transparent',
                  border:
                    difficulty === d
                      ? `1px solid ${DIFFICULTY_COLORS[d]}80`
                      : '1px solid rgba(255,255,255,0.1)',
                  color: difficulty === d ? DIFFICULTY_COLORS[d] : 'rgba(100,116,139,0.5)',
                  transition: 'all 200ms',
                }}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>İÇERİK:</label>
          <textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            placeholder="Deneyimini anlat... Teknikler, araçlar, öğrendiklerin..."
            style={{ ...inputStyle, resize: 'vertical' }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.5)'
              e.target.style.boxShadow = '0 0 10px rgba(0,255,65,0.08)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.15)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>ETİKETLER: (virgülle ayır)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="sql, injection, bypass"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.5)'
              e.target.style.boxShadow = '0 0 10px rgba(0,255,65,0.08)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.15)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            paddingTop: 12,
            paddingBottom: 12,
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            background: 'rgba(0,255,65,0.1)',
            border: '1px solid rgba(0,255,65,0.5)',
            color: '#00ff41',
            transition: 'all 200ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,255,65,0.2)'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,65,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,255,65,0.1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          [ POSTU YAYINLA ]
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar Widgets ──────────────────────────────────────────────────────────

function SidebarWidget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          color: 'rgba(0,255,65,0.4)',
          fontSize: 9,
          fontFamily: 'monospace',
          marginBottom: 12,
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const POPULAR_TAGS = [
  '#sql', '#xss', '#ctf', '#linux', '#privesc',
  '#network', '#malware', '#osint', '#pentest', '#crypto',
]

const MEMBERS = [
  { name: 'ghost', status: 'online' as const },
  { name: 'r3d_phantom', status: 'online' as const },
  { name: 'n3t_hunter', status: 'away' as const },
]

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<CategoryType>('ALL')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyType>('ALL')
  const [sort, setSort] = useState<SortType>('newest')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('auth_user') === 'ghost')
    setIsDesktop(window.innerWidth >= 1024)
    setPosts(loadPosts())
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const refresh = useCallback(() => {
    setPosts(loadPosts())
    if (selectedPost) {
      const updated = loadPosts().find((p) => p.id === selectedPost.id)
      if (updated) setSelectedPost(updated)
    }
  }, [selectedPost])

  const handleLike = useCallback((postId: string) => {
    const current = loadPosts()
    const updated = current.map((p) => {
      if (p.id !== postId) return p
      const alreadyLiked = p.likes.includes('ghost')
      return {
        ...p,
        likes: alreadyLiked ? p.likes.filter((u) => u !== 'ghost') : [...p.likes, 'ghost'],
      }
    })
    savePosts(updated)
    setPosts(updated)
    if (selectedPost?.id === postId) {
      setSelectedPost(updated.find((p) => p.id === postId) ?? null)
    }
  }, [selectedPost])

  const handleLikeComment = useCallback((postId: string, commentId: string) => {
    const current = loadPosts()
    const updated = current.map((p) => {
      if (p.id !== postId) return p
      return {
        ...p,
        comments: p.comments.map((c) => {
          if (c.id !== commentId) return c
          const liked = c.likes.includes('ghost')
          return {
            ...c,
            likes: liked ? c.likes.filter((u) => u !== 'ghost') : [...c.likes, 'ghost'],
          }
        }),
      }
    })
    savePosts(updated)
    setPosts(updated)
    if (selectedPost?.id === postId) {
      setSelectedPost(updated.find((p) => p.id === postId) ?? null)
    }
  }, [selectedPost])

  const handleAddComment = useCallback((postId: string, content: string) => {
    const current = loadPosts()
    const newComment: Comment = {
      id: Date.now().toString(),
      author: 'ghost',
      content,
      createdAt: new Date().toISOString(),
      likes: [],
    }
    const updated = current.map((p) => {
      if (p.id !== postId) return p
      return { ...p, comments: [...p.comments, newComment] }
    })
    savePosts(updated)
    setPosts(updated)
    if (selectedPost?.id === postId) {
      setSelectedPost(updated.find((p) => p.id === postId) ?? null)
    }
  }, [selectedPost])

  const handleNewPost = useCallback((post: CommunityPost) => {
    const current = loadPosts()
    const updated = [post, ...current]
    savePosts(updated)
    setPosts(updated)
    setShowForm(false)
  }, [])

  // Filter + sort
  let filtered = [...posts]
  if (categoryFilter !== 'ALL') filtered = filtered.filter((p) => p.category === categoryFilter)
  if (difficultyFilter !== 'ALL') filtered = filtered.filter((p) => p.difficulty === difficultyFilter)
  if (tagFilter) filtered = filtered.filter((p) => p.tags.includes(tagFilter.replace('#', '')))

  if (sort === 'newest') filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  else if (sort === 'popular') filtered.sort((a, b) => b.likes.length - a.likes.length)
  else filtered.sort((a, b) => b.views - a.views)

  const totalLikes = posts.reduce((acc, p) => acc + p.likes.length, 0)
  const totalComments = posts.reduce((acc, p) => acc + p.comments.length, 0)

  const pillBase: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 9,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'all 200ms',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(100,116,139,0.5)',
    background: 'transparent',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#08080f',
        fontFamily: 'monospace',
        paddingLeft: isLoggedIn && isDesktop ? 220 : 0,
      }}
    >
      {/* Page Header */}
      <div
        style={{
          borderBottom: '1px solid rgba(0,255,65,0.1)',
          padding: '20px 24px',
          background: '#050508',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              color: '#00ff41',
              fontSize: 18,
              fontWeight: 'bold',
              letterSpacing: '0.2em',
              fontFamily: 'monospace',
            }}
          >
            [ COMMUNITY INTEL ]
          </div>
          <div
            style={{
              color: 'rgba(100,116,139,0.6)',
              fontSize: 11,
              fontFamily: 'monospace',
              marginTop: 4,
            }}
          >
            Topluluk deneyimlerini paylaş — Öğren, paylaş, büyü
          </div>
        </div>
        {isLoggedIn && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '8px 16px',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer',
              background: 'rgba(0,255,65,0.08)',
              border: '1px solid rgba(0,255,65,0.4)',
              color: '#00ff41',
              transition: 'all 200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,255,65,0.15)'
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0,255,65,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,255,65,0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            + YENİ POST
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(5,5,8,0.8)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Category filters */}
        {(['ALL', 'CTF', 'WEB', 'PENTEST', 'MALWARE', 'OSINT', 'NETWORK', 'GENERAL'] as const).map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                ...pillBase,
                ...(categoryFilter === cat
                  ? {
                      border: '1px solid rgba(0,255,65,0.6)',
                      color: '#00ff41',
                      background: 'rgba(0,255,65,0.08)',
                    }
                  : {}),
              }}
              onMouseEnter={(e) => {
                if (categoryFilter !== cat) {
                  e.currentTarget.style.borderColor = 'rgba(0,255,65,0.3)'
                  e.currentTarget.style.color = 'rgba(0,255,65,0.6)'
                }
              }}
              onMouseLeave={(e) => {
                if (categoryFilter !== cat) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = 'rgba(100,116,139,0.5)'
                }
              }}
            >
              {cat}
            </button>
          )
        )}

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Difficulty filters */}
        {(['ALL', 'beginner', 'intermediate', 'advanced'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDifficultyFilter(d)}
            style={{
              ...pillBase,
              ...(difficultyFilter === d
                ? {
                    border: '1px solid rgba(245,158,11,0.6)',
                    color: '#f59e0b',
                    background: 'rgba(245,158,11,0.08)',
                  }
                : {}),
            }}
            onMouseEnter={(e) => {
              if (difficultyFilter !== d) {
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'
                e.currentTarget.style.color = 'rgba(245,158,11,0.6)'
              }
            }}
            onMouseLeave={(e) => {
              if (difficultyFilter !== d) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = 'rgba(100,116,139,0.5)'
              }
            }}
          >
            {d === 'ALL' ? 'ALL' : d.toUpperCase()}
          </button>
        ))}

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Sort */}
        {(
          [
            { key: 'newest', label: 'EN YENİ' },
            { key: 'popular', label: 'EN POPÜLER' },
            { key: 'views', label: 'EN ÇOK GÖRÜNTÜLENEN' },
          ] as { key: SortType; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            style={{
              ...pillBase,
              ...(sort === key
                ? {
                    border: '1px solid rgba(0,255,65,0.4)',
                    color: 'rgba(0,255,65,0.8)',
                    background: 'rgba(0,255,65,0.05)',
                  }
                : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div
        style={{
          padding: '8px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          gap: 24,
        }}
      >
        {[
          `[ ${posts.length} POST ]`,
          `[ ${totalLikes} BEĞENİ ]`,
          `[ ${totalComments} YORUM ]`,
        ].map((stat) => (
          <span
            key={stat}
            style={{ color: 'rgba(0,255,65,0.4)', fontSize: 9, fontFamily: 'monospace' }}
          >
            {stat}
          </span>
        ))}
      </div>

      {/* Main grid */}
      <div
        style={{
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 1fr 1fr' : '1fr',
          gap: 24,
        }}
      >
        {/* Left: posts (2 cols on desktop) */}
        <div style={{ gridColumn: isDesktop ? 'span 2' : 'span 1' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                color: 'rgba(100,116,139,0.4)',
                fontFamily: 'monospace',
                fontSize: 12,
                textAlign: 'center',
                paddingTop: 40,
              }}
            >
              // Filtrelere uyan post bulunamadı
            </div>
          ) : (
            filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isLoggedIn={isLoggedIn}
                onLike={handleLike}
                onClick={(p) => setSelectedPost(p)}
              />
            ))
          )}
        </div>

        {/* Right: sidebar */}
        <div>
          {/* Active members */}
          <SidebarWidget title="// aktif üyeler">
            {MEMBERS.map((member) => (
              <div
                key={member.name}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: member.status === 'online' ? '#00ff41' : '#f59e0b',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color:
                      member.name === 'ghost' ? '#00ff41' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {member.name === 'ghost' ? '[ GHOST ]' : member.name}
                </span>
              </div>
            ))}
          </SidebarWidget>

          {/* Popular tags */}
          <SidebarWidget title="// popüler etiketler">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    transition: 'all 200ms',
                    background:
                      tagFilter === tag ? 'rgba(0,255,65,0.1)' : 'transparent',
                    border:
                      tagFilter === tag
                        ? '1px solid rgba(0,255,65,0.4)'
                        : '1px solid rgba(0,255,65,0.15)',
                    color:
                      tagFilter === tag ? '#00ff41' : 'rgba(0,255,65,0.4)',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </SidebarWidget>

          {/* Community stats */}
          <SidebarWidget title="// topluluk istatistikleri">
            {[
              { label: 'Toplam Post', value: posts.length.toString() },
              { label: 'Üyeler', value: '3' },
              { label: 'Bu Hafta', value: posts.filter((p) => Date.now() - new Date(p.createdAt).getTime() < 604800000).length.toString() },
              {
                label: 'En Aktif',
                value: (() => {
                  const counts: Record<string, number> = {}
                  posts.forEach((p) => { counts[p.category] = (counts[p.category] ?? 0) + 1 })
                  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
                })(),
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
              >
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(100,116,139,0.5)' }}>
                  {label}
                </span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(0,255,65,0.7)' }}>
                  {value}
                </span>
              </div>
            ))}
          </SidebarWidget>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <NewPostForm onClose={() => setShowForm(false)} onSubmit={handleNewPost} />
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          isLoggedIn={isLoggedIn}
          onClose={() => setSelectedPost(null)}
          onLike={handleLike}
          onLikeComment={handleLikeComment}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  )
}
