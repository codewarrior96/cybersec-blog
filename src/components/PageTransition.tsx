'use client'

import { usePathname } from 'next/navigation'
import type { RouteTheme } from '@/lib/route-theme'
import { getRouteTheme } from '@/lib/route-theme'

export default function PageTransition({
  children,
  theme,
}: {
  children: React.ReactNode
  theme?: RouteTheme
}) {
  const pathname = usePathname() ?? ''
  const disableTransition = pathname === '/' || pathname === '/home'
  const routeTheme = theme ?? getRouteTheme(pathname)

  if (disableTransition) {
    return <>{children}</>
  }

  return (
    <div key={pathname} data-transition-skin={routeTheme} className={`page-transition page-transition--${routeTheme}`}>
      {children}
    </div>
  )
}
