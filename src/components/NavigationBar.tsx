'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface NavigationBarProps {
  threatCount: number;
  warnCount: number;
  currentPath: string;
  onLogout: () => void;
}

const NAV_LINKS = [
  { label: 'HOME', href: '/' },
  { label: 'BLOG', href: '/blog' },
  { label: 'COMMUNITY', href: '/community' },
  { label: 'CVE-RADAR', href: '/cve-radar' },
  { label: 'TIMELINE', href: '/timeline' },
  { label: 'PORTFOLIO', href: '/portfolio' },
  { label: 'ABOUT', href: '/about' },
];

function isPathActive(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function ShieldIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0 text-[var(--accent-cyan)]"
      style={{ filter: 'drop-shadow(0 0 6px #00d4ff)' }}
    >
      <path
        d="M12 2.5L4.5 5.5V11.8C4.5 16.6 7.6 20.9 12 22.5C16.4 20.9 19.5 16.6 19.5 11.8V5.5L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 6.8V18.2M8.7 10.2H15.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M15.5 17.5H8.5C7.12 17.5 6 16.38 6 15V10.4C6 6.87 8.47 4 12 4C15.53 4 18 6.87 18 10.4V15C18 16.38 16.88 17.5 15.5 17.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9.5 17.5V18C9.5 19.38 10.62 20.5 12 20.5C13.38 20.5 14.5 19.38 14.5 18V17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M12 3V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function NavigationBar({
  threatCount,
  warnCount,
  currentPath,
  onLogout,
}: NavigationBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [currentPath]);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <header className="navbar-root w-full">
      <div className="mx-auto hidden min-h-[64px] w-full items-center justify-between gap-4 px-4 md:flex">
        <div className="flex shrink-0 items-center">
          <Link href="/" className="flex min-h-[44px] items-center gap-3">
            <ShieldIcon size={28} />
            <div className="leading-[1.05]">
              <div className="font-mono text-[15px] font-bold tracking-[0.15em] text-white">BREACH TERMINAL</div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.1em] text-[var(--text-muted)]">OS v4.1</div>
            </div>
          </Link>
          <div className="mx-6 h-8 w-px bg-[rgba(0,255,136,0.2)]" />
        </div>

        <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto">
          {NAV_LINKS.map((link) => {
            const active = isPathActive(currentPath, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex min-h-[44px] items-center border-b-2 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-all duration-150 ease-[ease] ${
                  active
                    ? 'border-b-[var(--accent-green)] bg-[rgba(0,255,136,0.08)] text-[var(--accent-green)]'
                    : 'border-b-transparent text-[var(--text-muted)] hover:rounded hover:bg-[rgba(0,255,136,0.06)] hover:text-[var(--accent-green)]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded border border-[rgba(255,71,87,0.35)] bg-[rgba(255,71,87,0.12)] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#ff4757]">
            {'\u26A1'} THREATS: {threatCount}
          </span>
          <span className="rounded border border-[rgba(255,165,2,0.35)] bg-[rgba(255,165,2,0.12)] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#ffa502]">
            {'\u25B2'} WARNS: {warnCount}
          </span>

          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--accent-green)]"
            aria-label="Notifications"
          >
            <BellIcon />
            {threatCount > 0 && <span className="absolute right-0 top-0 h-[6px] w-[6px] rounded-full bg-[#ff4757]" />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] rounded border border-[rgba(0,255,136,0.3)] px-3 py-1.5 text-[10px] tracking-[0.12em] text-[var(--accent-green)] transition-all duration-200 hover:bg-[rgba(0,255,136,0.1)]"
          >
            [ LOGOUT ]
          </button>
        </div>
      </div>

      <div className="flex h-14 items-center justify-between gap-2 px-3 md:hidden">
        <Link href="/" className="flex min-h-[44px] items-center gap-2">
          <ShieldIcon size={24} />
          <div className="leading-none">
            <div className="font-mono text-[12px] font-bold tracking-[0.12em] text-white">BREACH TERMINAL</div>
            <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-[var(--text-muted)]">OS v4.1</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[rgba(255,71,87,0.4)] bg-[rgba(255,71,87,0.2)] px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-[#ff4757]">
            {'\u26A1'} {threatCount}
          </span>
          <span className="rounded-full border border-[rgba(255,165,2,0.4)] bg-[rgba(255,165,2,0.2)] px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-[#ffa502]">
            {'\u25B2'} {warnCount}
          </span>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--accent-green)]"
            aria-label="Notifications"
          >
            <BellIcon />
            {threatCount > 0 && <span className="absolute right-0 top-0 h-[6px] w-[6px] rounded-full bg-[#ff4757]" />}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
          >
            <span
              className={`h-px w-5 bg-white transition-all duration-200 ${
                isOpen ? 'translate-y-[5px] rotate-45' : ''
              }`}
            />
            <span className={`h-px w-5 bg-white transition-all duration-200 ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
            <span
              className={`h-px w-5 bg-white transition-all duration-200 ${
                isOpen ? '-translate-y-[5px] -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-[rgba(0,0,0,0.7)] transition-opacity duration-200 md:hidden ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsOpen(false)}
        style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        aria-hidden={!isOpen}
      />

      <aside
        id="mobile-nav-drawer"
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-[min(320px,100vw)] flex-col border-l border-[rgba(0,255,136,0.15)] bg-[#0a0f1a] shadow-[-20px_0_60px_rgba(0,0,0,0.6)] transition-transform md:hidden ${
          isOpen
            ? 'pointer-events-auto translate-x-0 duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'pointer-events-none translate-x-full duration-[220ms] ease-[cubic-bezier(0.7,0,0.84,0)]'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-16 items-center justify-between border-b border-[rgba(0,255,136,0.1)] px-4">
          <div className="flex items-center gap-2">
            <ShieldIcon size={24} />
            <div className="leading-none">
              <div className="font-mono text-[12px] font-bold tracking-[0.12em] text-white">BREACH TERMINAL</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-[var(--text-muted)]">OS v4.1</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--accent-green)]"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="grid h-9 grid-cols-2">
          <div className="flex items-center border-l-[3px] border-l-[#ff4757] bg-[rgba(255,71,87,0.08)] pl-4 text-[11px] tracking-[0.1em] text-[#ff4757]">
            THREATS: {threatCount}
          </div>
          <div className="flex items-center border-l-[3px] border-l-[#ffa502] bg-[rgba(255,165,2,0.08)] pl-4 text-[11px] tracking-[0.1em] text-[#ffa502]">
            WARNS: {warnCount}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {NAV_LINKS.map((link) => {
            const active = isPathActive(currentPath, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex h-[52px] items-center border-b border-b-[rgba(255,255,255,0.04)] border-l-[3px] pl-6 text-[12px] uppercase tracking-[0.15em] transition-all duration-150 ${
                  active
                    ? 'border-l-[var(--accent-green)] bg-[rgba(0,255,136,0.06)] font-bold text-[var(--accent-green)]'
                    : 'border-l-transparent font-medium text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
                }`}
              >
                <span className="mr-3 opacity-50">{'\u203A'}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4 pt-3">
          <div className="border-t border-t-[rgba(0,255,136,0.1)]" />
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 h-12 w-full rounded border border-[rgba(255,71,87,0.3)] bg-[rgba(255,71,87,0.1)] text-[11px] tracking-[0.15em] text-[#ff4757] transition-colors duration-200 hover:bg-[rgba(255,71,87,0.2)]"
          >
            {'\u23FB'}  LOGOUT
          </button>
        </div>
      </aside>
    </header>
  );
}
