'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const navItems = [
  {
    label: '~/home',
    href: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: '~/blog',
    href: '/blog',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    label: '~/community',
    href: '/community',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: '~/portfolio',
    href: '/portfolio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
  },
  {
    label: '~/cve-radar',
    href: '/cve-radar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: '~/timeline',
    href: '/breach-timeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: '~/roadmap',
    href: '/roadmap',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    label: '~/about',
    href: '/about',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

const quickIntel = [
  { label: 'CVEs Bugün', value: '14', valueColor: 'rgba(0,255,65,0.7)' },
  { label: 'Aktif Tehdit', value: '3', valueColor: '#f59e0b' },
  { label: 'Writeup', value: '8', valueColor: 'rgba(0,255,65,0.7)' },
  { label: 'CTF Çözüm', value: '6', valueColor: 'rgba(0,255,65,0.7)' },
]

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function OperatorSidebar() {
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [sessionStart] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [logoutHover, setLogoutHover] = useState(false)

  useEffect(() => {
    setIsLoggedIn(
      typeof window !== 'undefined' && localStorage.getItem('auth_user') === 'ghost'
    )
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - sessionStart)
    }, 1000)
    return () => clearInterval(interval)
  }, [isLoggedIn, sessionStart])

  if (!isLoggedIn) return null

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 220,
        zIndex: 40,
        background: '#050508',
        borderRight: '1px solid rgba(0,255,65,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      className="hidden lg:flex"
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,65,0.015) 3px, rgba(0,255,65,0.015) 4px)',
          zIndex: 0,
        }}
      />

      {/* Profile section */}
      <div
        style={{
          background: 'rgba(0,255,65,0.02)',
          borderBottom: '1px solid rgba(0,255,65,0.08)',
          padding: 16,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid rgba(0,255,65,0.4)',
              background: 'black',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(0,255,65,0.3)',
            }}
          >
            <svg viewBox="0 0 100 120" fill="#00ff41" style={{ width: 20, height: 20 }}>
              <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z" />
            </svg>
          </div>

          {/* Info */}
          <div>
            <div
              style={{
                color: '#00ff41',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                fontSize: 13,
              }}
            >
              ghost
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div
                className="animate-pulse"
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff41' }}
              />
              <span
                style={{
                  color: 'rgba(0,255,65,0.5)',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              >
                ONLINE
              </span>
            </div>
            <div
              style={{
                color: 'rgba(0,255,65,0.25)',
                fontSize: 8,
                fontFamily: 'monospace',
                marginTop: 2,
              }}
            >
              [ SECURITY RESEARCHER ]
            </div>
          </div>
        </div>
      </div>

      {/* Session stats */}
      <div
        style={{
          margin: '12px',
          padding: 12,
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(0,255,65,0.08)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {[
          { label: 'SESSION', value: formatElapsed(elapsed), valueColor: 'rgba(0,255,65,0.8)' },
          { label: 'THREAT LVL', value: 'ELEVATED', valueColor: '#f59e0b' },
          { label: 'SYS STATUS', value: null },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: i < 2 ? 6 : 0,
            }}
          >
            <span
              style={{ color: 'rgba(0,255,65,0.3)', fontSize: 8, fontFamily: 'monospace' }}
            >
              {row.label}
            </span>
            {row.value ? (
              <span style={{ color: row.valueColor, fontSize: 8, fontFamily: 'monospace' }}>
                {row.value}
              </span>
            ) : (
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#00ff41', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span className="animate-pulse">●</span> ACTIVE
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8, position: 'relative', zIndex: 1 }}>
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: active ? '8px 16px 8px 14px' : '8px 16px',
                transition: 'all 200ms',
                cursor: 'pointer',
                textDecoration: 'none',
                color: active ? '#00ff41' : 'rgba(100,116,139,1)',
                background: active ? 'rgba(0,255,65,0.06)' : 'transparent',
                borderLeft: active ? '2px solid #00ff41' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#00ff41'
                  e.currentTarget.style.background = 'rgba(0,255,65,0.03)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = 'rgba(100,116,139,1)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {item.icon}
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div
        style={{
          borderTop: '1px solid rgba(0,255,65,0.05)',
          margin: '8px 16px',
          position: 'relative',
          zIndex: 1,
        }}
      />

      {/* Quick intel */}
      <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            color: 'rgba(0,255,65,0.25)',
            fontSize: 8,
            fontFamily: 'monospace',
            marginBottom: 8,
          }}
        >
          // quick intel
        </div>
        {quickIntel.map((item) => (
          <div
            key={item.label}
            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}
          >
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(100,116,139,0.6)' }}>
              {item.label}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: item.valueColor }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div
        style={{
          borderTop: '1px solid rgba(0,255,65,0.08)',
          padding: 12,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <button
          onClick={() => {
            localStorage.removeItem('auth_user')
            window.location.href = '/'
          }}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          style={{
            width: '100%',
            paddingTop: 8,
            paddingBottom: 8,
            fontFamily: 'monospace',
            fontSize: 10,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            transition: 'all 200ms',
            background: logoutHover ? 'rgba(239,68,68,0.05)' : 'transparent',
            border: logoutHover
              ? '1px solid rgba(239,68,68,0.6)'
              : '1px solid rgba(239,68,68,0.2)',
            color: logoutHover ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.5)',
          }}
        >
          [ LOGOUT ]
        </button>
        <div
          style={{
            color: 'rgba(0,255,65,0.1)',
            fontSize: 8,
            fontFamily: 'monospace',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          v2.0.26 // BREACH TERMINAL
        </div>
      </div>
    </aside>
  )
}
