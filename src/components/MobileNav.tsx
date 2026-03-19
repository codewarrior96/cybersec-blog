'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { logoutAuth, useAuthStatus } from '@/lib/auth-client'

const mobileItems = [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Community', href: '/community' },
  { label: 'CVE', href: '/cve-radar' },
]

interface MobileNavProps {
  initialAuth?: boolean | null
}

export default function MobileNav({ initialAuth = null }: MobileNavProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState<boolean | null>(null)
  const authStatus = useAuthStatus(initialAuth)

  useEffect(() => {
    const check = () => setVisible(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (pathname === '/login') return null
  if (visible !== true) return null
  if (authStatus !== true) return null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <div
      className="lg:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: '#050508',
        borderTop: '1px solid rgba(0,255,65,0.1)',
        height: 56,
        display: 'flex',
      }}
    >
      {mobileItems.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: active ? '#00ff41' : 'rgba(100,116,139,0.5)',
              textDecoration: 'none',
              fontFamily: 'monospace',
              fontSize: 10,
            }}
          >
            {item.label}
          </Link>
        )
      })}
      <button
        onClick={async () => {
          if (!window.confirm('Cikis yapmak istiyor musunuz?')) return
          await logoutAuth()
          window.location.href = '/'
        }}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          color: 'rgba(239,68,68,0.8)',
          fontFamily: 'monospace',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  )
}
