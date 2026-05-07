'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface NavigationBarProps {
  currentPath?: string
  onLogout?: () => void
}

const NAV_LINKS = [
  { label: 'HOME', href: '/home' },
  { label: 'BLOG', href: '/blog' },
  { label: 'COMMUNITY', href: '/community' },
  { label: 'ZAFİYET TARAMASI', href: '/zafiyet-taramasi' },
  { label: 'PORTFOLIO', href: '/portfolio' },
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

function SkullLogo({
  skullRef,
}: {
  skullRef: React.RefObject<HTMLDivElement>
}) {
  // UX-005 → UX-006 → decoration polish — skull is now purely
  // ornamental. No click action, no anchor wrapper, no interactive
  // affordance at all. Ambient animations (float bob, ring pulse,
  // orbit, glow pulse, image pulse) drive the resting visual. The
  // element is aria-hidden — it is decoration only.
  return (
    <div className="nb2-skull-wrap" ref={skullRef}>
      <div className="nb2-skull-btn" aria-hidden="true">
        <span className="nb2-skull-ring-pulse" aria-hidden="true" />
        <span className="nb2-skull-ring-orbit" aria-hidden="true" />
        <span className="nb2-skull-disc" aria-hidden="true" />
      </div>
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
  currentPath = '/',
  onLogout,
}: NavigationBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
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
  }, [currentPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

