// A-26 closure (Wave 12): the 'academy' theme replaces the former
// 'community' literal alongside the /community → /academy route rename.
// No external consumers carried the 'community' string at the time of
// rename; theme system is internal-only classification.
export type RouteTheme = 'matrix' | 'academy' | 'sentinel' | 'profile'

export function getRouteTheme(pathname?: string | null): RouteTheme {
  const path = pathname ?? ''

  if (path === '/academy' || path.startsWith('/academy/')) {
    return 'academy'
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
