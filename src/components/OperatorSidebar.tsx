'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { clearAuthUser, useAuthStatus } from '@/lib/auth-client'

const navItems = [
  {
    label: '~/home', href: '/',
    icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  },
  {
    label: '~/blog', href: '/blog',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  },
  {
    label: '~/community', href: '/community',
    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  },
  {
    label: '~/portfolio', href: '/portfolio',
    icon: 'M2 7a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2z M16 3v4 M8 3v4',
  },
  {
    label: '~/cve-radar', href: '/cve-radar',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
  {
    label: '~/timeline', href: '/breach-timeline',
    icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 6v6l4 2',
  },
  {
    label: '~/roadmap', href: '/roadmap',
    icon: 'M1 6l7-4 8 4 7-4v14l-7 4-8-4-7 4z M8 2v14 M16 6v14',
  },
  {
    label: '~/about', href: '/about',
    icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8z',
  },
]

const stats = [
  { label: 'POSTS', value: '8',  color: '#00ff41' },
  { label: 'CTF',   value: '6',  color: '#00ff41' },
  { label: 'CVE',   value: '14', color: '#ef4444' },
]

const quickIntel = [
  { label: 'CVE_TODAY', value: '14', color: '#ef4444' },
  { label: 'THREATS',   value: '3',  color: '#f59e0b' },
  { label: 'WRITEUPS',  value: '8',  color: '#00ff41' },
  { label: 'CTF',       value: '6',  color: '#00ff41' },
]

interface OperatorSidebarProps {
  initialAuth?: boolean | null
}

export default function OperatorSidebar({ initialAuth = null }: OperatorSidebarProps) {
  const pathname = usePathname()
  const authStatus = useAuthStatus(initialAuth)
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')

  useEffect(() => {
    const applyShellOffset = () => {
      const isDesktop = window.innerWidth >= 1024
      const shouldOffset = authStatus === true && !isLoginRoute && isDesktop
      document.documentElement.style.setProperty('--operator-shell-offset', shouldOffset ? '220px' : '0px')
    }

    applyShellOffset()
    window.addEventListener('resize', applyShellOffset)
    return () => {
      window.removeEventListener('resize', applyShellOffset)
      document.documentElement.style.setProperty('--operator-shell-offset', '0px')
    }
  }, [authStatus, isLoginRoute])

  if (isLoginRoute) return null
  if (authStatus !== true) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
        @keyframes glitch1 {
          0%,89%,100% { clip-path: inset(0 0 100% 0); transform: translateX(0); }
          90% { clip-path: inset(30% 0 50% 0); transform: translateX(-4px); color: #ff00ff; }
          92% { clip-path: inset(60% 0 20% 0); transform: translateX(4px);  color: #00ffff; }
          94% { clip-path: inset(0 0 100% 0); }
        }
        @keyframes glitch2 {
          0%,91%,100% { clip-path: inset(0 0 100% 0); transform: translateX(0); }
          92% { clip-path: inset(50% 0 30% 0); transform: translateX(4px);  color: #00ffff; }
          94% { clip-path: inset(20% 0 60% 0); transform: translateX(-4px); color: #ff00ff; }
          96% { clip-path: inset(0 0 100% 0); }
        }
        @keyframes avatarGlow {
          0%,100% { box-shadow: 0 0 20px rgba(0,255,65,0.4); }
          50%      { box-shadow: 0 0 35px rgba(0,255,65,0.9), 0 0 60px rgba(0,255,65,0.3); }
        }
        @keyframes logoutPulse {
          0%,100% { box-shadow: 0 0 8px rgba(239,68,68,0.4), inset 0 0 8px rgba(239,68,68,0.1); }
          50%     { box-shadow: 0 0 25px rgba(239,68,68,0.9), 0 0 50px rgba(239,68,68,0.4), inset 0 0 15px rgba(239,68,68,0.2); }
        }
        @keyframes iconPulse {
          0%,100% { filter: drop-shadow(0 0 3px rgba(239,68,68,0.6)); }
          50%     { filter: drop-shadow(0 0 10px rgba(239,68,68,1)); }
        }
        @keyframes flicker {
          0%,100% { opacity: 1; }
          92%     { opacity: 1; }
          93%     { opacity: 0.4; }
          94%     { opacity: 1; }
          96%     { opacity: 0.8; }
          97%     { opacity: 1; }
        }
        .op-nav { scrollbar-width: none; }
        .op-nav::-webkit-scrollbar { display: none; }
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
          background: '#070710',
          borderRight: '1px solid #1a2a1a',
        }}
      >
        {/* Scanline */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '60px',
          background: 'linear-gradient(transparent, rgba(0,255,65,0.03), transparent)',
          animation: 'scanline 5s linear infinite',
          pointerEvents: 'none',
          zIndex: 10,
        }} />

        {/* Top glow line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #00ff41, transparent)',
        }} />

        {/* All content */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column',
          height: '100%',
          animation: 'flicker 10s infinite',
        }}>

          {/* ── PROFILE ── */}
          <div style={{
            padding: '22px 16px 16px',
            borderBottom: '1px solid #1a2a1a',
            background: 'rgba(0,255,65,0.015)',
            textAlign: 'center',
          }}>
            {/* Avatar */}
            <div style={{
              width: 72, height: 72, borderRadius: 9999,
              border: '2px solid #00ff41',
              background: 'radial-gradient(circle, #001a00, #000)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto',
              animation: 'avatarGlow 3s ease-in-out infinite',
            }}>
              <svg viewBox="0 0 100 120" fill="#00ff41" style={{ width: 34, height: 38 }}>
                <path d="M50 8 C28 8 12 24 12 46 C12 58 17 68 26 75 L26 95 C26 98 29 100 32 100 L44 100 L44 88 L56 88 L56 100 L68 100 C71 100 74 98 74 95 L74 75 C83 68 88 58 88 46 C88 24 72 8 50 8 Z M37 60 C32 60 28 56 28 51 C28 46 32 42 37 42 C42 42 46 46 46 51 C46 56 42 60 37 60 Z M63 60 C58 60 54 56 54 51 C54 46 58 42 63 42 C68 42 72 46 72 51 C72 56 68 60 63 60 Z" />
              </svg>
            </div>

            {/* Glitch name */}
            <div style={{ position: 'relative', textAlign: 'center', marginTop: 12 }}>
              <div style={{
                color: '#00ff41', fontSize: 15, fontWeight: 'bold',
                fontFamily: 'monospace', letterSpacing: '0.1em',
              }}>
                ghost
              </div>
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 0,
                color: '#ff00ff', opacity: 0.5,
                fontSize: 15, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.1em',
                animation: 'glitch1 6s infinite',
                pointerEvents: 'none',
              }}>
                ghost
              </div>
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 0,
                color: '#00ffff', opacity: 0.5,
                fontSize: 15, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.1em',
                animation: 'glitch2 6s infinite 0.5s',
                pointerEvents: 'none',
              }}>
                ghost
              </div>
            </div>

            {/* Role */}
            <div style={{
              color: '#336633', fontSize: 9, fontFamily: 'monospace',
              letterSpacing: '0.15em', marginTop: 4,
            }}>
              SECURITY RESEARCHER
            </div>

            {/* Status row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, marginTop: 10,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: 9999,
                background: '#00ff41',
              }} />
              <span style={{ color: '#00cc44', fontSize: 9, fontFamily: 'monospace' }}>ONLINE</span>
              <span style={{ color: '#333', fontSize: 9, fontFamily: 'monospace' }}>|</span>
              <span style={{ color: '#f59e0b', fontSize: 9, fontFamily: 'monospace' }}>THREAT: HIGH</span>
            </div>
          </div>

          {/* ── STATS GRID ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            borderBottom: '1px solid #1a2a1a',
          }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{
                padding: '12px 8px', textAlign: 'center',
                borderRight: i < stats.length - 1 ? '1px solid #1a2a1a' : undefined,
              }}>
                <div style={{
                  fontSize: 18, fontWeight: 'bold',
                  fontFamily: 'monospace', color: s.color,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontSize: 7, color: '#336633',
                  fontFamily: 'monospace', marginTop: 3, letterSpacing: '0.1em',
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── NAVIGATION ── */}
          <div style={{ padding: '8px 14px 4px', marginTop: 4 }}>
            <div style={{
              color: '#336633', fontSize: 8,
              fontFamily: 'monospace', letterSpacing: '0.2em',
            }}>
              // NAVIGATION
            </div>
          </div>

          <nav className="op-nav" style={{ flex: 1, overflowY: 'auto' }}>
            {navItems.map((item, idx) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    textDecoration: 'none', transition: 'all 0.15s ease',
                    fontSize: 12, fontFamily: 'monospace',
                    color: active ? '#00ff41' : '#7a9a7a',
                    background: active ? 'rgba(0,255,65,0.07)' : 'transparent',
                    borderLeft: active ? '2px solid #00ff41' : '2px solid transparent',
                    borderBottom: idx === navItems.length - 1 ? '1px solid #1a2a1a' : undefined,
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
                  <span>{item.label}</span>
                  {active && (
                    <div style={{
                      marginLeft: 'auto',
                      width: 6, height: 6, borderRadius: 9999,
                      background: '#00ff41',
                      boxShadow: '0 0 6px #00ff41',
                    }} />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* ── QUICK INTEL ── */}
          <div style={{
            borderBottom: '1px solid #1a2a1a',
            background: '#060610',
            padding: '8px 0 6px',
          }}>
            <div style={{
              padding: '4px 14px 6px',
              color: '#336633', fontSize: 8,
              fontFamily: 'monospace', letterSpacing: '0.2em',
            }}>
              // QUICK INTEL
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              margin: '0 10px', gap: 1,
            }}>
              {quickIntel.map((item) => (
                <div key={item.label} style={{
                  padding: '8px 10px',
                  background: '#080814',
                  border: '1px solid #1a1a2a',
                }}>
                  <span style={{
                    display: 'block',
                    fontSize: 8, color: '#446644',
                    fontFamily: 'monospace',
                  }}>
                    {item.label}
                  </span>
                  <span style={{
                    display: 'block',
                    fontSize: 16, fontWeight: 'bold',
                    fontFamily: 'monospace', color: item.color,
                    marginTop: 2,
                  }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── LOGOUT ── */}
          <div style={{
            padding: '16px 12px 12px',
            background: '#080810',
            borderTop: '1px solid #1a2a1a',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 10,
          }}>
            <button
              onClick={() => {
                clearAuthUser()
                window.location.href = '/'
              }}
              style={{
                width: 44, height: 44, borderRadius: 9999,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                animation: 'logoutPulse 2s ease-in-out infinite',
              }}
            >
              <svg
                viewBox="0 0 24 24" fill="none" stroke="#ef4444"
                strokeWidth="2" strokeLinecap="round"
                style={{ width: 20, height: 20, animation: 'iconPulse 2s ease-in-out infinite' }}
              >
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </button>
            <div style={{
              color: '#1a3a1a', fontSize: 7,
              fontFamily: 'monospace', letterSpacing: '0.08em',
            }}>
              BREACH TERMINAL v2.0.26
            </div>
          </div>

        </div>
      </aside>
    </>
  )
}
