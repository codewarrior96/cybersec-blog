export type RouteTheme = 'matrix' | 'community' | 'sentinel' | 'profile'

export function getRouteTheme(pathname?: string | null): RouteTheme {
  const path = pathname ?? ''

  if (path === '/community' || path.startsWith('/community/')) {
    return 'community'
  }

  if (
    path === '/zafiyet-taramasi' ||
    path.startsWith('/zafiyet-taramasi/') ||
    path === '/cve-radar' ||
    path.startsWith('/cve-radar/') ||
    path === '/breach-timeline' ||
    path.startsWith('/breach-timeline/')
  ) {
    return 'sentinel'
  }

  if (
    path === '/portfolio' ||
    path.startsWith('/portfolio/') ||
    path === '/register' ||
    path.startsWith('/register/')
  ) {
    return 'profile'
  }

  return 'matrix'
}
