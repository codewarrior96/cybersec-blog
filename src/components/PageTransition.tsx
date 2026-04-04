'use client'

import { usePathname } from 'next/navigation'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const disableTransition = pathname === '/' || pathname === '/home'

  if (disableTransition) {
    return <>{children}</>
  }

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  )
}
