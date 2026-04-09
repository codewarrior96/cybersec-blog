'use client'

import React, { useCallback, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthSession, logoutAuth } from '@/lib/auth-client'
import OperatorSidebar from '@/components/OperatorSidebar'
import Footer from '@/components/Footer'
import SearchModal from '@/components/SearchModal'
import PageTransition from '@/components/PageTransition'
import NavigationBar from '@/components/NavigationBar'
import { getRouteTheme } from '@/lib/route-theme'

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
  const routeTheme = getRouteTheme(pathname)

  const isLoginRoute = pathname === '/login' || pathname?.startsWith('/login/')
  const isRegisterRoute = pathname === '/register' || pathname?.startsWith('/register/')
  const isRootRoute = pathname === '/' || pathname === '/home'

  const isAuthGatewayRoute = isLoginRoute || isRegisterRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute && !isRegisterRoute
  const showGlobalTools = !isAuthGatewayRoute && !showOperatorShell

  useEffect(() => {
    if (!showOperatorShell) return
    const routes = ['/home', '/blog', '/community', '/zafiyet-taramasi', '/portfolio']
    for (const route of routes) {
      if (route === pathname) continue
      void router.prefetch(route)
    }
  }, [pathname, router, showOperatorShell])

  const handleLogout = useCallback(async () => {
    await logoutAuth()
    router.push('/')
  }, [router])

  return (
    <>
      <OperatorSidebar initialAuth={isAuthed} />
      <div data-route-theme={routeTheme} className="route-shell transition-all duration-300 flex flex-col flex-1 app-shell">
        {showOperatorShell && (
          <NavigationBar
            currentPath={pathname ?? '/'}
            onLogout={handleLogout}
          />
        )}
        <PageTransition theme={routeTheme}>
          <main className="route-shell-main flex-1">{children}</main>
        </PageTransition>
        {showGlobalTools && <Footer />}
      </div>
      {showGlobalTools && <SearchModal posts={posts} />}
    </>
  )
}
