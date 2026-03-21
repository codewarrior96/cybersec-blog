'use client'

import React, { useEffect, useState } from 'react'
import EmbeddedLogin from '@/components/EmbeddedLogin'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import type { PostMeta } from '@/components/SOCDashboard'
import { useAuthStatus } from '@/lib/auth-client'

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

interface HomePageClientProps {
  initialAuth: boolean
}

export default function HomePageClient({ initialAuth }: HomePageClientProps) {
  const authStatus = useAuthStatus(initialAuth)
  const [posts, setPosts] = useState<PostMeta[]>([])

  useEffect(() => {
    if (authStatus !== true) {
      setPosts([])
      return
    }

    fetch('/api/posts')
      .then((response) => response.json())
      .then((payload: unknown) => {
        if (Array.isArray(payload)) {
          setPosts(payload as PostMeta[])
        } else if (payload && typeof payload === 'object' && 'posts' in payload) {
          setPosts((payload as { posts: PostMeta[] }).posts ?? [])
        }
      })
      .catch(() => {})
  }, [authStatus])

  if (authStatus === null) {
    return null
  }

  if (authStatus) {
    return (
      <ErrorBoundary
        fallback={
          <div style={{ color: 'red', padding: '20px', fontFamily: 'monospace' }}>
            SOC Dashboard Error - Check Console
          </div>
        }
      >
        <DashboardLayout />
      </ErrorBoundary>
    )
  }

  return <EmbeddedLogin />
}
