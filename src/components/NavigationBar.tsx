'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface NavigationBarProps {
  threatCount?: number
  warnCount?: number
  currentPath?: string
  onLogout?: () => void
}

const NAV_LINKS = [
  { label: 'HOME', href: '/' },
  { label: 'BLOG', href: '/blog' },
  { label: 'COMMUNITY', href: '/community' },
  { label: 'CVE-RADAR', href: '/cve-radar' },
  { label: 'TIMELINE', href: '/breach-timeline' },
  { label: 'PORTFOLIO', href: '/portfolio' },
  { label: 'ABOUT', href: '/about' },
] as const

function ShieldMark({ size }: { size: number }) {
  const height = Math.round((size * 30) / 26)
  return (
    <svg width={size} height={height} viewBox="0 0 26 30" aria-hidden="true" className="nb2-shield">
      <path d="M13 0L0 5v10c0 8.28 5.54 16.03 13 18 7.46-1.97 13-9.72 13-18V5L13 0z" fill="none" />
      <path d="M13 4L3 8v7c0 5.52 3.7 10.7 10 12.5 6.3-1.8 10-6.98 10-12.5V8L13 4z" />
      <text x="13" y="18" textAnchor="middle">
        C
      </text>
    </svg>
  )
}

function BellMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function isActivePath(currentPath: string, href: string) {
  if (href === '/') return currentPath === '/'
  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export default function NavigationBar({
  threatCount = 1,
  warnCount = 14,
  currentPath = '/',
  onLogout,
}: NavigationBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

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
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <header className="nb2-root">
        <Link href="/" className="nb2-brand" aria-label="Breach Terminal Home">
          <ShieldMark size={26} />
          <div className="nb2-brand-copy">
            <span className="nb2-brand-title">BREACH TERMINAL</span>
            <span className="nb2-brand-subtitle">OS v4.1</span>
          </div>
        </Link>

        <nav className="nb2-links" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isActivePath(currentPath, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nb2-link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="nb2-tools">
          <span className="nb2-pill nb2-pill-threat">THREATS: {threatCount}</span>
          <span className="nb2-pill nb2-pill-warn">WARNS: {warnCount}</span>
          <button type="button" className="nb2-icon-btn" aria-label="Notifications">
            <BellMark />
            {threatCount > 0 && <span className="nb2-dot" />}
          </button>
          <button type="button" className="nb2-logout" onClick={onLogout}>
            [ LOGOUT ]
          </button>
        </div>

        <div className="nb2-mobile-tools">
          <span className="nb2-pill nb2-pill-threat nb2-mobile-pill">{threatCount}</span>
          <span className="nb2-pill nb2-pill-warn nb2-mobile-pill">{warnCount}</span>
          <button type="button" className="nb2-icon-btn" aria-label="Notifications">
            <BellMark />
            {threatCount > 0 && <span className="nb2-dot" />}
          </button>
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

            <div className="nb2-drawer-stats">
              <span className="nb2-pill nb2-pill-threat">THREATS: {threatCount}</span>
              <span className="nb2-pill nb2-pill-warn">WARNS: {warnCount}</span>
            </div>

            <nav className="nb2-drawer-links">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(currentPath, link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nb2-drawer-link ${active ? 'is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <span className="nb2-caret">&gt;</span>
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            <div className="nb2-drawer-footer">
              <button
                type="button"
                className="nb2-drawer-logout"
                onClick={() => {
                  onLogout?.()
                  setDrawerOpen(false)
                }}
              >
                LOGOUT
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
