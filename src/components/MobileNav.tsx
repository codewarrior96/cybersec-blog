'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Shield, Newspaper, Users, Radio, Cpu } from 'lucide-react'
import { useAuthSession } from '@/lib/auth-client'

const mobileItems = [
  { label: 'HOME', href: '/', icon: Shield },
  { label: 'RADAR', href: '/cve-radar', icon: Radio },
  { label: 'LOGS', href: '/blog', icon: Newspaper },
  { label: 'SQUAD', href: '/community', icon: Users },
  { label: 'SYS', href: '/about', icon: Cpu },
]

interface MobileNavProps {
  initialAuth?: boolean | null
}

export default function MobileNav({ initialAuth = null }: MobileNavProps) {
  const pathname = usePathname()
  const session = useAuthSession(initialAuth)

  if (!session?.authenticated) return null

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 lg:hidden flex items-center justify-around bg-[#0a0f16]/95 backdrop-blur-md border-t border-cyan-900/50 pb-4 pt-3 px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
      {mobileItems.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 min-w-[64px] ${
              isActive 
                ? 'text-cyan-400 bg-[#0c1a22] shadow-[inset_0_0_15px_rgba(34,211,238,0.25)] border border-cyan-800/60 translate-y-[-4px]'
                : 'text-gray-500 hover:text-cyan-200 border border-transparent'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1.5 transition-all ${isActive ? 'filter drop-shadow-[0_0_8px_#22d3ee] scale-110' : 'scale-95'}`} />
            <span className={`text-[8.5px] font-mono tracking-widest transition-all ${isActive ? 'font-bold opacity-100' : 'font-medium opacity-70'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
