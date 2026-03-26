'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NavigationBarProps {
  threatCount?: number;
  warnCount?: number;
  currentPath?: string;
  onLogout?: () => void;
}

const NAV_LINKS = [
  { label: 'HOME', href: '/' },
  { label: 'BLOG', href: '/blog' },
  { label: 'COMMUNITY', href: '/community' },
  { label: 'CVE-RADAR', href: '/cve-radar' },
  { label: 'TIMELINE', href: '/timeline' },
  { label: 'PORTFOLIO', href: '/portfolio' },
  { label: 'ABOUT', href: '/about' },
] as const;

function ShieldIcon({ size }: { size: number }) {
  const h = Math.round(size * (30 / 26));
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 26 30"
      style={{ filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.6))', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M13 0L0 5v10c0 8.28 5.54 16.03 13 18 7.46-1.97 13-9.72 13-18V5L13 0z"
        fill="none"
        stroke="#00d4ff"
        strokeWidth="1.5"
      />
      <path
        d="M13 4L3 8v7c0 5.52 3.7 10.7 10 12.5 6.3-1.8 10-6.98 10-12.5V8L13 4z"
        fill="rgba(0,212,255,0.08)"
      />
      <text
        x="13"
        y="18"
        textAnchor="middle"
        fill="#00d4ff"
        fontSize="9"
        fontWeight="bold"
      >
        C
      </text>
    </svg>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Divider() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 1,
        height: 28,
        background: 'rgba(0,255,136,0.2)',
        marginLeft: 24,
        marginRight: 24,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}

function BellButton({ threatCount, isMobile }: { threatCount: number; isMobile?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Notifications"
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      <BellIcon color={hovered ? 'var(--accent-green)' : 'var(--text-muted)'} />
      {threatCount > 0 && (
        <span
          className="nb-pulse nb-threat-glow"
          style={{
            position: 'absolute',
            top: isMobile ? 8 : 8,
            right: isMobile ? 8 : 8,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--threat-red)',
            border: '1.5px solid var(--bg-primary)',
          }}
        />
      )}
    </button>
  );
}

export default function NavigationBar({
  threatCount = 1,
  warnCount = 14,
  currentPath = '/',
  onLogout,
}: NavigationBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [currentPath]);

  function openDrawer() {
    setClosing(false);
    setIsOpen(true);
  }

  function closeDrawer() {
    setClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setClosing(false);
    }, 220);
  }

  const isActive = (href: string) =>
    href === '/' ? currentPath === '/' : currentPath.startsWith(href);

  return (
    <>
      {/* ─── BAR ─────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 56,
          background: 'rgba(10,15,26,0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,255,136,0.12)',
          boxShadow: '0 1px 0 rgba(0,255,136,0.08), 0 4px 32px rgba(0,0,0,0.5)',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <ShieldIcon size={26} />
          <div style={{ marginLeft: 12 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              BREACH TERMINAL
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                lineHeight: 1.2,
              }}
            >
              OS v4.1
            </div>
          </div>
        </div>

        <Divider />

        {/* NAV LINKS — desktop only */}
        <nav
          className="nb-desktop-nav"
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? 'nb-nav-link nb-nav-link--active' : 'nb-nav-link'}
                style={{
                  position: 'relative',
                  padding: '6px 14px',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  fontWeight: active ? 700 : 500,
                  textTransform: 'uppercase',
                  borderRadius: 3,
                  textDecoration: 'none',
                  color: active ? 'var(--accent-green)' : 'var(--text-muted)',
                  background: active ? 'rgba(0,255,136,0.1)' : 'transparent',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT ACTIONS — desktop only */}
        <div
          className="nb-desktop-right"
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
        >
          <span
            className="nb-threat-glow"
            style={{
              background: 'rgba(255,71,87,0.12)',
              border: '1px solid rgba(255,71,87,0.4)',
              color: 'var(--threat-red)',
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: 10,
              letterSpacing: '0.1em',
              fontWeight: 700,
              boxShadow: '0 0 12px rgba(255,71,87,0.15) inset',
              whiteSpace: 'nowrap',
            }}
          >
            ⚡ THREATS: {threatCount}
          </span>
          <span
            style={{
              background: 'rgba(255,165,2,0.12)',
              border: '1px solid rgba(255,165,2,0.4)',
              color: 'var(--warning-orange)',
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: 10,
              letterSpacing: '0.1em',
              fontWeight: 700,
              boxShadow: '0 0 12px rgba(255,165,2,0.15) inset',
              whiteSpace: 'nowrap',
            }}
          >
            ▲ WARNS: {warnCount}
          </span>

          <Divider />

          <BellButton threatCount={threatCount} />

          <LogoutButton onLogout={onLogout} />
        </div>

        {/* MOBILE RIGHT — pills + bell + hamburger */}
        <div
          className="nb-mobile-right"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 9,
              background: 'rgba(255,71,87,0.2)',
              border: '1px solid rgba(255,71,87,0.5)',
              color: 'var(--threat-red)',
              padding: '2px 8px',
              borderRadius: 9999,
              fontWeight: 700,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            ⚡ {threatCount}
          </span>
          <span
            style={{
              fontSize: 9,
              background: 'rgba(255,165,2,0.2)',
              border: '1px solid rgba(255,165,2,0.5)',
              color: 'var(--warning-orange)',
              padding: '2px 8px',
              borderRadius: 9999,
              fontWeight: 700,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            ▲ {warnCount}
          </span>

          <BellButton threatCount={threatCount} isMobile />

          {/* Hamburger */}
          <button
            onClick={isOpen ? closeDrawer : openDrawer}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span
              className="hamburger-line"
              style={{ transform: isOpen ? 'translateY(6.5px) rotate(45deg)' : undefined }}
            />
            <span
              className="hamburger-line"
              style={{ opacity: isOpen ? 0 : 1, transform: isOpen ? 'scaleX(0)' : undefined }}
            />
            <span
              className="hamburger-line"
              style={{ transform: isOpen ? 'translateY(-6.5px) rotate(-45deg)' : undefined }}
            />
          </button>
        </div>

        {/* MOBILE LOGO — hidden on desktop, shown on mobile in place of desktop logo */}
        {/* (handled by the main logo block via responsive CSS) */}
      </header>

      {/* ─── MOBILE DRAWER ───────────────────────────────────────── */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={closeDrawer}
            className="nb-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            className={`nb-drawer${closing ? ' nb-drawer--closing' : ' nb-drawer--open'}`}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              width: 'min(300px, 100vw)',
              background: 'var(--bg-primary)',
              borderLeft: '1px solid rgba(0,255,136,0.15)',
              boxShadow: '-24px 0 80px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 16,
                paddingRight: 8,
                borderBottom: '1px solid rgba(0,255,136,0.1)',
                flexShrink: 0,
              }}
            >
              <ShieldIcon size={22} />
              <div style={{ marginLeft: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  BREACH TERMINAL
                </div>
              </div>
              <button
                onClick={closeDrawer}
                aria-label="Close menu"
                style={{
                  marginLeft: 'auto',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
                className="nb-close-btn"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Status Row */}
            <div style={{ display: 'flex', height: 40, flexShrink: 0 }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 16,
                  borderLeft: '3px solid var(--threat-red)',
                  background: 'rgba(255,71,87,0.07)',
                  color: 'var(--threat-red)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                THREATS: {threatCount}
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 16,
                  borderLeft: '3px solid var(--warning-orange)',
                  background: 'rgba(255,165,2,0.07)',
                  color: 'var(--warning-orange)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                WARNS: {warnCount}
              </div>
            </div>

            {/* Nav Links */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeDrawer}
                    className={active ? 'nb-mobile-link nb-mobile-link--active' : 'nb-mobile-link'}
                    style={{
                      height: 50,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 20,
                      gap: 12,
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      borderLeft: `3px solid ${active ? 'var(--accent-green)' : 'transparent'}`,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      fontWeight: active ? 700 : 500,
                      textTransform: 'uppercase',
                      textDecoration: 'none',
                      color: active ? 'var(--accent-green)' : 'var(--text-muted)',
                      background: active ? 'rgba(0,255,136,0.07)' : 'transparent',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    <span
                      style={{
                        color: active ? 'var(--accent-green)' : 'rgba(0,255,136,0.4)',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      ›
                    </span>
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div
              style={{
                borderTop: '1px solid rgba(0,255,136,0.1)',
                margin: '0 16px',
                padding: '16px 0',
                flexShrink: 0,
              }}
            >
              <DrawerLogoutButton onLogout={onLogout} closeDrawer={closeDrawer} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onLogout}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: hovered ? '1px solid rgba(0,255,136,0.5)' : '1px solid rgba(0,255,136,0.25)',
        color: 'var(--accent-green)',
        background: hovered ? 'rgba(0,255,136,0.08)' : 'transparent',
        boxShadow: hovered ? '0 0 16px rgba(0,255,136,0.15)' : 'none',
        padding: '5px 14px',
        borderRadius: 3,
        fontSize: 10,
        letterSpacing: '0.14em',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
        minHeight: 44,
      }}
    >
      [ LOGOUT ]
    </button>
  );
}

function DrawerLogoutButton({
  onLogout,
  closeDrawer,
}: {
  onLogout?: () => void;
  closeDrawer: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => { onLogout?.(); closeDrawer(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        height: 46,
        background: hovered ? 'rgba(255,71,87,0.18)' : 'rgba(255,71,87,0.1)',
        border: '1px solid rgba(255,71,87,0.3)',
        color: 'var(--threat-red)',
        fontSize: 11,
        letterSpacing: '0.18em',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        cursor: 'pointer',
        borderRadius: 3,
        transition: 'background 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      ⏻&nbsp;&nbsp;LOGOUT
    </button>
  );
}
