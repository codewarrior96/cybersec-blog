'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthSession } from '@/lib/auth-client'
import OperatorSidebar from '@/components/OperatorSidebar'
import MobileNav from '@/components/MobileNav'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SearchModal from '@/components/SearchModal'
import PageTransition from '@/components/PageTransition'

export default function AppShellClient({
  children,
  initialAuth,
  posts,
}: {
  children: React.ReactNode
  initialAuth: boolean
  posts: any[]
}) {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const session = useAuthSession(initialAuth)

  useEffect(() => { setMounted(true) }, [])

  // Before mount: use initialAuth (matches SSR). After mount: use live session.
  const isAuthed = mounted ? (session?.authenticated ?? false) : initialAuth

  const isLoginRoute = pathname === '/login' || pathname?.startsWith('/login/')
  const isRootRoute = pathname === '/'

  const isAuthGatewayRoute = isLoginRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute
  const showPublicHeader = !showOperatorShell && !isAuthGatewayRoute
  const showGlobalTools = !isAuthGatewayRoute && !showOperatorShell

  return (
    <>
      <OperatorSidebar initialAuth={isAuthed} />
      <MobileNav initialAuth={isAuthed} />
      <div className={`transition-all duration-300 flex flex-col flex-1 app-shell pb-20 lg:pb-0 ${showOperatorShell ? 'app-shell--sidebar' : ''}`}>
        {showPublicHeader && <Header initialAuth={isAuthed} />}
        <PageTransition>
          <main className="flex-1">{children}</main>
        </PageTransition>
        {showGlobalTools && <Footer />}
      </div>
      {showGlobalTools && <SearchModal posts={posts} />}
    </>
  )
}
