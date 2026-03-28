'use client'

import React, { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthSession, logoutAuth } from '@/lib/auth-client'
import OperatorSidebar from '@/components/OperatorSidebar'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SearchModal from '@/components/SearchModal'
import PageTransition from '@/components/PageTransition'
import NavigationBar from '@/components/NavigationBar'

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
  const router = useRouter()
  const session = useAuthSession(initialAuth)
  const isAuthed = session?.authenticated ?? false

  const isLoginRoute = pathname === '/login' || pathname?.startsWith('/login/')
  const isRootRoute = pathname === '/' || pathname === '/home'

  const isAuthGatewayRoute = isLoginRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute
  const showPublicHeader = !showOperatorShell && !isAuthGatewayRoute
  const showGlobalTools = !isAuthGatewayRoute && !showOperatorShell

  const handleLogout = useCallback(async () => {
    await logoutAuth()
    router.push('/')
  }, [router])

  return (
    <>
      <OperatorSidebar initialAuth={isAuthed} />
      <div className={`transition-all duration-300 flex flex-col flex-1 app-shell`}>
        {showOperatorShell && (
          <NavigationBar
            currentPath={pathname ?? '/'}
            onLogout={handleLogout}
          />
        )}
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
