'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useAuthSession } from '@/lib/auth-client'
import OperatorSidebar from '@/components/OperatorSidebar'
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
  const pathname = usePathname()
  const session = useAuthSession(initialAuth)
  const isAuthed = session?.authenticated ?? false

  const isLoginRoute = pathname === '/login' || pathname?.startsWith('/login/')
  const isRootRoute = pathname === '/' || pathname === '/home'

  const isAuthGatewayRoute = isLoginRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute
  const showGlobalTools = !isAuthGatewayRoute && !showOperatorShell

  return (
    <>
      <OperatorSidebar initialAuth={isAuthed} />
      <div className={`transition-all duration-300 flex flex-col flex-1 app-shell`}>
        <PageTransition>
          <main className="flex-1">{children}</main>
        </PageTransition>
        {showGlobalTools && <Footer />}
      </div>
      {showGlobalTools && <SearchModal posts={posts} />}
    </>
  )
}
