'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { clearAuthUser, useAuthStatus } from '@/lib/auth-client'

const mobileItems = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Blog',
    href: '/blog',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    label: 'Community',
    href: '/community',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: 'CVE',
    href: '/cve-radar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
]

interface MobileNavProps {
  initialAuth?: boolean | null
}

export default function MobileNav({ initialAuth = null }: MobileNavProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState<boolean | null>(null)
  const authStatus = useAuthStatus(initialAuth)

  useEffect(() => {
    const check = () => {
      setVisible(window.innerWidth < 1024)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (pathname === '/login') return null
  if (visible !== true) return null
  if (authStatus !== true) return null

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div
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
      className="lg:hidden"
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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              transition: 'all 200ms',
              color: active ? '#00ff41' : 'rgba(100,116,139,0.4)',
              textDecoration: 'none',
            }}
          >
            {item.icon}
            <span style={{ fontSize: 8, fontFamily: 'monospace' }}>{item.label}</span>
          </Link>
        )
      })}

      {/* Profile / Logout */}
      <button
        onClick={() => {
          if (window.confirm('Çıkış yapmak istiyor musunuz?')) {
            clearAuthUser()
            window.location.href = '/'
          }
        }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          cursor: 'pointer',
          transition: 'all 200ms',
          color: 'rgba(100,116,139,0.4)',
          background: 'transparent',
          border: 'none',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span style={{ fontSize: 8, fontFamily: 'monospace' }}>Profile</span>
      </button>
    </div>
  )
}
