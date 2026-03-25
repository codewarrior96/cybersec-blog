'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Shield, Newspaper, Users, Radio, Cpu, MoreHorizontal, Briefcase, Map, Clock } from 'lucide-react'
import { useAuthSession } from '@/lib/auth-client'

const mobileItems = [
  { label: 'HOME', href: '/', icon: Shield },
  { label: 'RADAR', href: '/cve-radar', icon: Radio },
  { label: 'LOGS', href: '/blog', icon: Newspaper },
  { label: 'SQUAD', href: '/community', icon: Users },
]

const drawerItems = [
  { label: 'SYS', href: '/about', icon: Cpu },
  { label: 'PORTFOLIO', href: '/portfolio', icon: Briefcase },
  { label: 'ROADMAP', href: '/roadmap', icon: Map },
  { label: 'TIMELINE', href: '/breach-timeline', icon: Clock },
]

interface MobileNavProps {
  initialAuth?: boolean | null
}

export default function MobileNav({ initialAuth = null }: MobileNavProps) {
  const pathname = usePathname()
  const session = useAuthSession(initialAuth)
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!session?.authenticated) return null

  return (
    <>
      {/* Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer Content */}
      <div 
        className={`fixed bottom-[72px] left-0 w-full z-40 lg:hidden bg-[#0a0f16]/95 backdrop-blur-md border-t border-cyan-900/50 rounded-t-2xl transition-transform duration-300 transform ${drawerOpen ? 'translate-y-0' : 'translate-y-[150%]'}`}
      >
        <div className="p-4 grid grid-cols-2 gap-3 pb-8">
          {drawerItems.map((item) => {
            const isActive = pathname?.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-cyan-900/20 border-cyan-500/50 text-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-cyan-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-mono text-[10px] tracking-widest">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 w-full z-50 lg:hidden flex items-center justify-around bg-[#0a0f16]/95 backdrop-blur-md border-t border-cyan-900/50 pb-4 pt-3 px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        {mobileItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
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

        {/* MORE Button */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 min-w-[64px] ${
            drawerOpen 
              ? 'text-cyan-400 bg-[#0c1a22] shadow-[inset_0_0_15px_rgba(34,211,238,0.25)] border border-cyan-800/60 translate-y-[-4px]'
              : 'text-gray-500 hover:text-cyan-200 border border-transparent'
          }`}
        >
          <MoreHorizontal className={`w-5 h-5 mb-1.5 transition-all ${drawerOpen ? 'filter drop-shadow-[0_0_8px_#22d3ee] scale-110' : 'scale-95'}`} />
          <span className={`text-[8.5px] font-mono tracking-widest transition-all ${drawerOpen ? 'font-bold opacity-100' : 'font-medium opacity-70'}`}>
            MORE
          </span>
        </button>
      </nav>
    </>
  )
}
