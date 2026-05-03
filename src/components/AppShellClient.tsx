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
  // Phase 4.5 — `/auth/*` (currently /auth/verify-pending and /verify) is
  // a chromeless gateway: the user has either just registered or is mid
  // email-verification flow. They have no active session, the global nav
  // would be misleading ("HOME · BLOG · …" links they can't actually
  // open), and the gateway is its own self-contained screen. Treat it
  // like /login and /register — render the page bare.
  //
  // Phase 5 — /forgot and /reset join the gateway list for the same
  // reason: the user is recovering a forgotten password, has no
  // session, and the password-reset screen is its own self-contained
  // flow. Both render chromeless.
  const isAuthFlowRoute =
    pathname === '/verify' ||
    pathname?.startsWith('/verify/') ||
    pathname?.startsWith('/auth/') ||
    pathname === '/forgot' ||
    pathname?.startsWith('/forgot/') ||
    pathname === '/reset' ||
    pathname?.startsWith('/reset/')
  const isRootRoute = pathname === '/' || pathname === '/home'

  const isAuthGatewayRoute =
    isLoginRoute || isRegisterRoute || isAuthFlowRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute && !isRegisterRoute && !isAuthFlowRoute
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
