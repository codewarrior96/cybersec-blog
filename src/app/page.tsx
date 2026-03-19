'use client'

import { useState, useEffect } from 'react'
import InteractiveTerminal from '@/components/InteractiveTerminal'
import SOCDashboard from '@/components/SOCDashboard'
import type { PostMeta } from '@/components/SOCDashboard'

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

  if (loggedIn) return <SOCDashboard posts={posts} />

  return (
    <div>
      <InteractiveTerminal />
    </div>
  )
}
