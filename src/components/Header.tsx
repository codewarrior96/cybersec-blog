'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStatus } from '@/lib/auth-client';
import Logo from '@/components/Logo';

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

  if (pathname === '/login') return null
  if (authStatus === null) return null
  if (authStatus) return null

  return (
    <header className="sticky top-0 z-50 border-b border-green-400/10 backdrop-blur-md bg-[#08080f]/85">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="block" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
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
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400/20 to-transparent" />
    </header>
  );
}
