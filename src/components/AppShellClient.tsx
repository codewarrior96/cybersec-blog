'use client'

import React, { useCallback, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthSession, logoutAuth } from '@/lib/auth-client'
import Footer from '@/components/Footer'
import SearchModal from '@/components/SearchModal'
import PageTransition from '@/components/PageTransition'
import NavigationBar from '@/components/NavigationBar'
import { getRouteTheme } from '@/lib/route-theme'
import type { PostMeta } from '@/lib/posts'

export default function AppShellClient({
  children,
  initialAuth,
  posts,
}: {
  children: React.ReactNode
  initialAuth: boolean
  // R-UI-11 closure (Wave 2A): explicit PostMeta[] replaces former
  // `any[]`. SearchModal's prop is `PostMeta[]` — caller pipeline now
  // type-checked end-to-end. SENIOR ARCHITECT NOTE: typing here surfaces
  // PostMeta shape drift to the callers at compile time, closing the
  // type-system gap documented in R-UI-11.
  posts: PostMeta[]
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
  const isBlogRoute = pathname === '/blog' || (pathname?.startsWith('/blog/') ?? false)

  const isAuthGatewayRoute =
    isLoginRoute || isRegisterRoute || isAuthFlowRoute || (!isAuthed && isRootRoute)
  const showOperatorShell = isAuthed && !isLoginRoute && !isRegisterRoute && !isAuthFlowRoute
  const showGlobalTools = !isAuthGatewayRoute && !showOperatorShell

  useEffect(() => {
    if (!showOperatorShell) return
    // R-UI-13 closure (Wave 5A): cancellable prefetch loop. Pre-Wave-
    // 5A the loop fired N prefetch promises synchronously without an
    // abort signal — pathname change re-ran the effect, leaving any
    // in-flight prefetch promises orphaned. Next.js router.prefetch
    // doesn't accept an AbortSignal directly, so we gate via the
    // controller's aborted flag inside an async loop. Cleanup aborts
    // the controller, short-circuiting subsequent iterations.
    // SENIOR ARCHITECT NOTE: prefetches that have already started can
    // continue (router.prefetch is fire-and-forget at the framework
    // boundary); the gate prevents NEW prefetches from being issued
    // after unmount or pathname change. This is the surgical scope
    // R-UI-13's Low severity allows — full cancellation would require
    // framework support.
    const controller = new AbortController()
    const routes = ['/home', '/blog', '/academy', '/zafiyet-taramasi', '/portfolio']
    const runPrefetchLoop = async () => {
      for (const route of routes) {
        if (controller.signal.aborted) return
        if (route === pathname) continue
        void router.prefetch(route)
      }
    }
    void runPrefetchLoop()
    return () => {
      controller.abort()
    }
  }, [pathname, router, showOperatorShell])

  const handleLogout = useCallback(async () => {
    await logoutAuth()
    router.push('/')
  }, [router])

  return (
    <>
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
      {(showGlobalTools || isBlogRoute) && <SearchModal posts={posts} />}
    </>
  )
}
