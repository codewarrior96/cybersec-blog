'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStatus } from '@/lib/auth-client';
import Logo from '@/components/Logo';
import { useState } from 'react';

const navLinks = [
  { href: '/blog',             label: 'Blog'           },
  { href: '/community',        label: '~/community'    },
  { href: '/portfolio',        label: 'Portfolio'      },
  { href: '/roadmap',          label: '~/roadmap'      },
  { href: '/cve-radar',        label: '~/cve-radar'    },
  { href: '/breach-timeline',  label: '~/timeline'     },
  { href: '/about',            label: 'Hakkımda'       },
];

interface HeaderProps {
  initialAuth?: boolean | null
}

export default function Header({ initialAuth = null }: HeaderProps) {
  const pathname = usePathname();
  const authStatus = useAuthStatus(initialAuth)
  const [isOpen, setIsOpen] = useState(false);

  if (pathname === '/login') return null
  if (authStatus === null) return null
  if (authStatus) return null

  return (
    <header className="sticky top-0 z-50 border-b border-green-400/10 backdrop-blur-md bg-[#08080f]/85">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="block" style={{ textDecoration: 'none' }} onClick={() => setIsOpen(false)}>
          <Logo />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200 ${
                  isActive
                    ? 'text-green-400 bg-green-400/10 border border-green-400/20 shadow-[0_0_8px_rgba(0,255,65,0.2)]'
                    : 'text-slate-400 hover:text-green-400 hover:bg-green-400/5 border border-transparent hover:border-green-400/15'
                }`}
              >
                {isActive && <span className="mr-1 opacity-60">›</span>}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 border border-green-400/20 rounded text-green-400 bg-green-400/5 active:scale-95 transition-transform"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Nav Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-green-400/10 bg-[#08080f] px-4 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded font-mono text-sm transition-all duration-200 ${
                  isActive
                    ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                    : 'text-slate-400 hover:text-green-400 hover:bg-green-400/5 border border-transparent hover:border-green-400/15'
                }`}
              >
                {isActive && <span className="mr-2 opacity-60">›</span>}
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400/20 to-transparent pointer-events-none" />
    </header>
  );
}
