'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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

function SkullLogo({
  skullRef,
}: {
  skullRef: React.RefObject<HTMLDivElement>
}) {
  // UX-005 — skull is no longer a logout trigger; it's a brand mark
  // that navigates to /home. The is-leaving / leaveTimer machinery
  // remains so the spin-close animation still plays gracefully on
  // hover-out. The previous isReady / readyTimer (BUG-003 click-gate
  // remnant) is dropped because there is no click-action to gate.
  const [isLeaving, setIsLeaving] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setIsLeaving(true)
    leaveTimer.current = setTimeout(() => setIsLeaving(false), 580)
  }

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setIsLeaving(false)
  }

  return (
    <div className="nb2-skull-wrap" ref={skullRef}>
      <Link
        href="/home"
        prefetch
        className={`nb2-skull-btn ${isLeaving ? 'is-leaving' : ''}`}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        aria-label="Home"
      >
        <span className="nb2-skull-ring-pulse" aria-hidden="true" />
        <span className="nb2-skull-ring-orbit" aria-hidden="true" />
        <span className="nb2-skull-disc" aria-hidden="true" />
      </Link>
    </div>
  )
}

function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  // UX-005 — dedicated, text-labelled logout affordance. Reuses the
  // existing `.nb2-logout` class (already present in globals.css, L1479)
  // which has the brand-correct monospace + uppercase + neon-green
  // styling. Used in nb2-tools (desktop) and as the trigger pattern
  // for the drawer bottom (mobile, with a wrapper class).
  return (
    <button
      type="button"
      className="nb2-logout"
      onClick={() => onLogout?.()}
      aria-label="Çıkış"
    >
      [ ÇIKIŞ ]
    </button>
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

  return (
    <>
      <header className="nb2-root">
        <SkullLogo skullRef={skullRef} />

        <nav className="nb2-links" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isActivePath(currentPath, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                className={`nb2-link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {active ? `[${link.label}]` : link.label}
              </Link>
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
          <LogoutButton onLogout={onLogout} />
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
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch
                    className={`nb2-drawer-link ${active ? 'is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <svg className="nb2-caret" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <polyline points="2,1 8,5 2,9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            <div className="nb2-drawer-divider" aria-hidden="true" />
            <div className="nb2-drawer-logout-wrap">
              <button
                type="button"
                className="nb2-drawer-logout-btn"
                onClick={() => {
                  onLogout?.()
                  setDrawerOpen(false)
                }}
                aria-label="Çıkış"
              >
                [ ÇIKIŞ ]
              </button>
            </div>

          </aside>
        </>
      )}
    </>
  )
}

