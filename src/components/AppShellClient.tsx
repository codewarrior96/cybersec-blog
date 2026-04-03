'use client'

import React, { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { logoutAuth } from '@/lib/auth-client'
import OperatorSidebar from '@/components/OperatorSidebar'
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
  // Derive auth purely from the server-provided prop so layout never flickers
  // between client events and navigation completing. NavBar only changes when
  // the server re-renders with a new initialAuth value (i.e. after navigation).
  const isAuthed = initialAuth

  const isLoginRoute = pathname === '/login' || pathname?.startsWith('/login/')
  const isRootRoute = pathname === '/' || pathname === '/home'

  const isAuthGatewayRoute = isLoginRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute
  const showGlobalTools = !isAuthGatewayRoute && !showOperatorShell

  const handleLogout = useCallback(async () => {
    await logoutAuth()
    window.location.href = '/'
  }, [])

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
        <PageTransition>
          <main className="flex-1">{children}</main>
        </PageTransition>
        {showGlobalTools && <Footer />}
      </div>
      {showGlobalTools && <SearchModal posts={posts} />}
    </>
  )
}
