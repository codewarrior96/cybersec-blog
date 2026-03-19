'use client'

import React, { useState, useEffect } from 'react'
import InteractiveTerminal from '@/components/InteractiveTerminal'
import SOCDashboard from '@/components/SOCDashboard'
import LoginModal from '@/components/LoginModal'
import type { PostMeta } from '@/components/SOCDashboard'

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface EBProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

interface EBState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      console.error('SOC Dashboard crashed:', this.state.error)
      return this.props.fallback
    }
    return this.props.children
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [posts, setPosts] = useState<PostMeta[]>([])

  useEffect(() => {
    const check = () => setLoggedIn(localStorage.getItem('auth_user') === 'ghost')
    check()
    const interval = setInterval(check, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    fetch('/api/posts')
      .then(r => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) {
          setPosts(d as PostMeta[])
        } else if (d && typeof d === 'object' && 'posts' in d) {
          setPosts((d as { posts: PostMeta[] }).posts ?? [])
        }
      })
      .catch(() => {})
  }, [loggedIn])

  if (loggedIn) {
    return (
      <ErrorBoundary
        fallback={
          <div style={{ color: 'red', padding: '20px', fontFamily: 'monospace' }}>
            SOC Dashboard Error — Check Console
          </div>
        }
      >
        <SOCDashboard posts={posts} />
      </ErrorBoundary>
    )
  }

  return (
    <div>
      <InteractiveTerminal />
      <LoginModal onClose={() => setLoggedIn(true)} />
    </div>
  )
}
