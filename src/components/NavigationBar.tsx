'use client'

import { useEffect, useRef, useState } from 'react'

interface NavigationBarProps {
  threatCount?: number
  warnCount?: number
  currentPath?: string
  username?: string
  onLogout?: () => void
}

const NAV_LINKS = [
  { label: 'HOME', href: '/home' },
  { label: 'BLOG', href: '/blog' },
  { label: 'COMMUNITY', href: '/community' },
  { label: 'SENTINEL', href: '/zafiyet-taramasi' },
  { label: 'PROFIL', href: '/portfolio' },
] as const

const CVE_BADGE_COUNT = 3

function ShieldMark({ size }: { size: number }) {
  const height = Math.round((size * 30) / 26)
  return (
    <svg width={size} height={height} viewBox="0 0 26 30" aria-hidden="true" className="nb2-shield">
      <path d="M13 0L0 5v10c0 8.28 5.54 16.03 13 18 7.46-1.97 13-9.72 13-18V5L13 0z" fill="none" />
      <path d="M13 4L3 8v7c0 5.52 3.7 10.7 10 12.5 6.3-1.8 10-6.98 10-12.5V8L13 4z" />
      <line x1="13" y1="10" x2="13" y2="20" className="nb2-shield-cross" />
      <line x1="8"  y1="15" x2="18" y2="15" className="nb2-shield-cross" />
      <circle cx="13" cy="15" r="2.5" className="nb2-shield-circle" />
    </svg>
  )
}


function SkullImage({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/skull.jpg"
      alt=""
      aria-hidden="true"
      className={`nb2-skull-img${className ? ` ${className}` : ''}`}
    />
  )
}

function ProfilePanel({
  username,
  threatCount,
  warnCount,
  onLogout,
  onClose,
}: {
  username: string
  threatCount: number
  warnCount: number
  onLogout?: () => void
  onClose: () => void
}) {
  return (
    <div className="nb2-profile-panel">
      <div className="nb2-profile-header">
        <div className="nb2-profile-avatar">
          <SkullImage />
        </div>
        <div className="nb2-profile-identity">
          <span className="nb2-profile-name">{username}</span>
          <span className="nb2-profile-role">BREACH OPERATOR</span>
        </div>
      </div>
      <div className="nb2-profile-stats">
        <div className="nb2-profile-stat">
          <span className="nb2-profile-stat-val nb2-profile-stat-red">{threatCount}</span>
          <span className="nb2-profile-stat-label">THREATS</span>
        </div>
        <div className="nb2-profile-stat">
          <span className="nb2-profile-stat-val nb2-profile-stat-amber">{warnCount}</span>
          <span className="nb2-profile-stat-label">WARNS</span>
        </div>
        <div className="nb2-profile-stat">
          <span className="nb2-profile-stat-val nb2-profile-stat-green">ACTIVE</span>
          <span className="nb2-profile-stat-label">STATUS</span>
        </div>
      </div>
      <div className="nb2-profile-actions">
        <button
          type="button"
          className="nb2-profile-logout"
          onClick={() => {
            onLogout?.()
            onClose()
          }}
        >
          [ TERMINATE SESSION ]
        </button>
      </div>
    </div>
  )
}

function SkullButton({
  skullRef,
  onLogout,
}: {
  skullRef: React.RefObject<HTMLDivElement>
  onLogout?: () => void
  profileOpen?: boolean
  onToggle?: () => void
  username?: string
  threatCount?: number
  warnCount?: number
}) {
  const [isLeaving, setIsLeaving] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    if (readyTimer.current) clearTimeout(readyTimer.current)
    setIsLeaving(true)
    setIsReady(false)
    leaveTimer.current = setTimeout(() => setIsLeaving(false), 580)
  }

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setIsLeaving(false)
    readyTimer.current = setTimeout(() => setIsReady(true), 520)
  }

  return (
    <div className="nb2-skull-wrap" ref={skullRef}>
      <button
        type="button"
        className={`nb2-skull-btn ${isLeaving ? 'is-leaving' : ''}`}
        onClick={() => { if (isReady) onLogout?.() }}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        aria-label="Logout"
      >
        <span className="nb2-skull-ring-pulse" aria-hidden="true" />
        <span className="nb2-skull-ring-orbit" aria-hidden="true" />
        <span className="nb2-skull-disc" aria-hidden="true">
          <span className="nb2-skull-hover-overlay" />
          <svg
            className="nb2-skull-logout-svg"
            width="24" height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <line x1="12" y1="2" x2="12" y2="9" />
            <path d="M6.34 5.34a8 8 0 1 0 11.32 0" />
          </svg>
        </span>
      </button>
      {/* profile panel removed — custom animation coming */}
    </div>
  )
}

function isActivePath(currentPath: string, href: string) {
  if (href === '/') return currentPath === '/' || currentPath === '/home'
  return currentPath === href || currentPath.startsWith(`${href}/`)
}

function getDaySegment(hour: number) {
  if (hour >= 5 && hour < 11) return 'SABAH'
  if (hour >= 11 && hour < 17) return 'OGLE'
  if (hour >= 17 && hour < 22) return 'AKSAM'
  return 'GECE'
}

export default function NavigationBar({
  threatCount = 1,
  warnCount = 14,
  currentPath = '/',
  username = 'OPERATOR',
  onLogout,
}: NavigationBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const skullRef = useRef<HTMLDivElement>(null)

  const timeLabel = now
    ? now.toLocaleTimeString('tr-TR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--'

  const dateLabel = now
    ? now.toLocaleDateString('tr-TR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }).toUpperCase()
    : '-- --.--'

  const daySegment = now ? getDaySegment(now.getHours()) : 'SYNC'

  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  useEffect(() => {
    setDrawerOpen(false)
    setProfileOpen(false)
  }, [currentPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!profileOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (skullRef.current && !skullRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [profileOpen])

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const navigateTo = (href: string) => {
    setDrawerOpen(false)
    setProfileOpen(false)
    if (currentPath === href) {
      window.location.reload()
      return
    }
    window.location.assign(href)
  }

  return (
    <>
      <header className="nb2-root">
        <SkullButton
          profileOpen={profileOpen}
          onToggle={() => setProfileOpen((v) => !v)}
          skullRef={skullRef}
          username={username}
          threatCount={threatCount}
          warnCount={warnCount}
          onLogout={onLogout}
        />

        <nav className="nb2-links" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isActivePath(currentPath, link.href)
            return (
              <button
                type="button"
                key={link.href}
                className={`nb2-link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onMouseDown={(event) => {
                  if (event.button !== 0) return
                  event.preventDefault()
                  navigateTo(link.href)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  navigateTo(link.href)
                }}
              >
                {active ? `[${link.label}]` : link.label}
              </button>
            )
          })}
        </nav>

        <div className="nb2-tools">
          <div className="nb2-retro-clock" role="status" aria-live="polite">
            <div className="nb2-retro-head">
              <span className="nb2-retro-label">LOCAL TIME</span>
              <span className="nb2-retro-date">{dateLabel}</span>
            </div>
            <div className="nb2-retro-body">
              <span className="nb2-retro-time">{timeLabel}</span>
              <span className="nb2-retro-segment">{daySegment}</span>
            </div>
          </div>
        </div>
        <div className="nb2-mobile-tools">
          <button
            type="button"
            className="nb2-menu-btn"
            onClick={() => setDrawerOpen((value) => !value)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
          >
            <span className={`nb2-menu-line ${drawerOpen ? 'is-open' : ''}`} />
            <span className={`nb2-menu-line ${drawerOpen ? 'is-open middle' : 'middle'}`} />
            <span className={`nb2-menu-line ${drawerOpen ? 'is-open' : ''}`} />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <>
          <button
            type="button"
            className="nb2-overlay"
            aria-label="Close menu overlay"
            onClick={() => setDrawerOpen(false)}
          />

          <aside className="nb2-drawer" aria-label="Mobile menu">
            <div className="nb2-drawer-head">
              <div className="nb2-brand nb2-brand-drawer">
                <ShieldMark size={22} />
                <div className="nb2-brand-copy">
                  <span className="nb2-brand-title">BREACH TERMINAL</span>
                </div>
              </div>
              <button type="button" className="nb2-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                X
              </button>
            </div>

            <nav className="nb2-drawer-links">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(currentPath, link.href)
                return (
                  <button
                    type="button"
                    key={link.href}
                    className={`nb2-drawer-link ${active ? 'is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return
                      event.preventDefault()
                      navigateTo(link.href)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      navigateTo(link.href)
                    }}
                  >
                    <svg className="nb2-caret" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <polyline points="2,1 8,5 2,9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {link.label}
                  </button>
                )
              })}
            </nav>

          </aside>
        </>
      )}
    </>
  )
}

