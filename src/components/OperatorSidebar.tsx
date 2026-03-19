'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const navItems = [
  { label: 'home',      href: '/',               icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10' },
  { label: 'blog',      href: '/blog',            icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { label: 'community', href: '/community',       icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  { label: 'portfolio', href: '/portfolio',       icon: 'M2 7a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2z M16 3v4 M8 3v4' },
  { label: 'cve-radar', href: '/cve-radar',       icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { label: 'timeline',  href: '/breach-timeline', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 6v6l4 2' },
  { label: 'roadmap',   href: '/roadmap',         icon: 'M1 6l7-4 8 4 7-4v14l-7 4-8-4-7 4z M8 2v14 M16 6v14' },
  { label: 'about',     href: '/about',           icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8z' },
]

const quickIntel = [
  { label: 'CVE_TODAY',  value: '14', color: '#ef4444' },
  { label: 'THREATS',    value: '3',  color: '#f59e0b' },
  { label: 'WRITEUPS',   value: '8',  color: '#00ff41' },
  { label: 'CTF_SOLVED', value: '6',  color: '#00ff41' },
]

export default function OperatorSidebar() {
  const pathname = usePathname()
  const [loggedIn, setLoggedIn] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [hoverItem, setHoverItem] = useState<string | null>(null)
  const [logoutHover, setLogoutHover] = useState(false)

  useEffect(() => {
    const check = () => setLoggedIn(localStorage.getItem('auth_user') === 'ghost')
    check()
    window.addEventListener('storage', check)
    document.addEventListener('auth_changed', check)
    return () => {
      window.removeEventListener('storage', check)
      document.removeEventListener('auth_changed', check)
    }
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    const start = Date.now()
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [loggedIn])

  if (!loggedIn) return null

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <style>{`
        @keyframes avatarPulse {
          0%,100% { box-shadow: 0 0 15px rgba(0,255,65,0.6), inset 0 0 10px rgba(0,255,65,0.05); }
          50%     { box-shadow: 0 0 25px rgba(0,255,65,0.5),  inset 0 0 15px rgba(0,255,65,0.4); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .op-nav::-webkit-scrollbar { display: none; }
        .op-nav { scrollbar-width: none; }
      `}</style>

      <aside
        className="hidden lg:flex"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: '220px',
          zIndex: 50,
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#0a0a12',
          borderRight: '1px solid rgba(0,255,65,0.15)',
          boxShadow: '4px 0 30px rgba(0,0,0,0.5), inset -1px 0 0 rgba(0,255,65,0.05)',
        }}
      >
        {/* Scanline overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,65,0.012) 3px, rgba(0,255,65,0.012) 4px)',
        }} />

        {/* Top glow line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px', zIndex: 0,
          background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.4), transparent)',
        }} />

        {/* ── PROFILE ── */}
        <div style={{
          padding: '14px 12px',
          borderBottom: '1px solid rgba(0,255,65,0.06)',
          background: 'rgba(0,255,65,0.015)',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: 9999,
              border: '2px solid rgba(0,255,65,0.7)',
              background: 'radial-gradient(circle, rgba(0,255,65,0.4) 0%, rgba(0,0,0,0.8) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              animation: 'avatarPulse 3s ease-in-out infinite',
            }}>
              <svg viewBox="0 0 100 120" fill="#00ff41" style={{ width: 20, height: 20, filter: 'drop-shadow(0 0 4px #00ff41)' }}>
                <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z" />
              </svg>
            </div>

            {/* Info */}
            <div>
              <div style={{
                color: '#00ff41', fontFamily: 'monospace', fontWeight: 'bold',
                fontSize: '13px', letterSpacing: '0.05em',
              }}>
                ghost
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 9999, backgroundColor: '#00ff41',
                  boxShadow: '0 0 6px #00ff41', animation: 'pulse 2s infinite',
                }} />
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.5)', letterSpacing: '0.15em' }}>
                  ONLINE
                </span>
              </div>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.35)', marginTop: '3px', letterSpacing: '0.1em' }}>
                [ SEC_RESEARCHER ]
              </div>
            </div>
          </div>
        </div>

        {/* ── SESSION MONITOR ── */}
        <div style={{
          margin: '8px', padding: '8px 10px',
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,65,0.07)',
          borderRadius: '2px', position: 'relative', overflow: 'hidden', zIndex: 1,
        }}>
          {/* Shimmer line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.7), transparent)',
            animation: 'shimmer 3s ease-in-out infinite',
          }} />

          {/* SESSION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 3, paddingBottom: 3 }}>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.6)', letterSpacing: '0.12em' }}>SESSION</span>
            <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', color: '#00ff41' }}>{formatTime(elapsed)}</span>
          </div>
          {/* THREAT_LVL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 3, paddingBottom: 3 }}>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.6)', letterSpacing: '0.12em' }}>THREAT_LVL</span>
            <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f59e0b' }}>ELEVATED</span>
          </div>
          {/* SYS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 3, paddingBottom: 3 }}>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.6)', letterSpacing: '0.12em' }}>SYS</span>
            <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', color: '#00ff41' }}>
              <span style={{ color: '#00ff41' }}>● </span>ACTIVE
            </span>
          </div>
        </div>

        {/* ── NAVIGATION + QUICK INTEL ── */}
        <nav className="op-nav" style={{
          flex: 1, overflowY: 'auto', padding: '8px 0',
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* Nav items group */}
          <div>
            <div style={{ padding: '8px 16px 4px', fontSize: '7px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.6)', letterSpacing: '0.2em' }}>
              // NAVIGATION
            </div>

            {navItems.map((item) => {
              const active = isActive(item.href)
              const hovered = hoverItem === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setHoverItem(item.href)}
                  onMouseLeave={() => setHoverItem(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: active ? '7px 14px 7px 12px' : '7px 14px',
                    cursor: 'pointer', textDecoration: 'none', transition: 'all 0.2s ease',
                    position: 'relative',
                    color: active ? '#00ff41' : hovered ? 'rgba(0,255,65,0.7)' : '#94a3b8',
                    background: active ? 'rgba(0,255,65,0.05)' : hovered ? 'rgba(0,255,65,0.02)' : 'transparent',
                    borderLeft: active ? '2px solid #00ff41' : '2px solid transparent',
                  }}
                >
                  <svg
                    width="13" height="13" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    {item.icon.split(' M').map((d, i) => (
                      <path key={i} d={(i === 0 ? '' : ' M') + d} />
                    ))}
                  </svg>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
                    ~/{item.label}
                  </span>

                  {/* Active indicator dot */}
                  {active && (
                    <div style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      width: 4, height: 4, borderRadius: 9999,
                      background: '#00ff41', boxShadow: '0 0 6px #00ff41',
                    }} />
                  )}
                </Link>
              )
            })}
          </div>

          {/* ── QUICK INTEL ── */}
          <div style={{
            borderTop: '1px solid rgba(0,255,65,0.06)',
            marginTop: '8px', paddingTop: '8px',
          }}>
            <div style={{ padding: '4px 16px 8px', fontSize: '7px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.6)', letterSpacing: '0.2em' }}>
              // QUICK INTEL
            </div>
            {quickIntel.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8', letterSpacing: '0.1em' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </nav>

        {/* ── BOTTOM ── */}
        <div style={{
          borderTop: '1px solid rgba(0,255,65,0.06)',
          padding: '12px',
          background: 'rgba(0,0,0,0.3)',
          position: 'relative', zIndex: 1,
        }}>
          <button
            onClick={() => { localStorage.removeItem('auth_user'); window.location.href = '/' }}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              width: '100%', padding: '8px', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 'bold',
              transition: 'all 0.2s', background: logoutHover ? 'rgba(239,68,68,0.05)' : 'transparent',
              border: logoutHover ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(239,68,68,0.2)',
              color: logoutHover ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.4)',
              boxShadow: logoutHover ? '0 0 10px rgba(239,68,68,0.1)' : 'none',
            }}
          >
            [ LOGOUT ]
          </button>
          <div style={{
            fontSize: '7px', fontFamily: 'monospace', color: 'rgba(0,255,65,0.4)',
            textAlign: 'center', marginTop: '8px', letterSpacing: '0.1em',
          }}>
            BREACH TERMINAL v2.0.26
          </div>
        </div>
      </aside>
    </>
  )
}
