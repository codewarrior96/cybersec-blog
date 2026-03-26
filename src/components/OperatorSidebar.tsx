'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { logoutAuth, useAuthSession } from '@/lib/auth-client'

interface OperatorSidebarProps {
  initialAuth?: boolean | null
}

const navItems = [
  { label: '~/home', href: '/' },
  { label: '~/blog', href: '/blog' },
  { label: '~/community', href: '/community' },
  { label: '~/portfolio', href: '/portfolio' },
  { label: '~/cve-radar', href: '/cve-radar' },
  { label: '~/timeline', href: '/breach-timeline' },
  { label: '~/roadmap', href: '/roadmap' },
  { label: '~/about', href: '/about' },
]

function roleLabel(role: string) {
  if (role === 'admin') return 'ADMIN'
  if (role === 'analyst') return 'ANALYST'
  return 'VIEWER'
}

export default function OperatorSidebar({ initialAuth = null }: OperatorSidebarProps) {
  // V2: Sidebar disabled — navigation moved to DashboardLayout top navbar
  return null;
  const pathname = usePathname()
  const router = useRouter()
  const session = useAuthSession(initialAuth)

  // Simulation states for animations
  const osintTarget = '192.168.1.45'
  const hashValue = 'a2b4c6d8f...'
  const [triggerCount, setTriggerCount] = useState(0)

  useEffect(() => {
    // Re-trigger animations every 8s to keep sidebar visually active (Demo specific)
    const interval = setInterval(() => {
      setTriggerCount(prev => prev + 1)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')
  const isAuthed = session?.authenticated === true
  const user = session?.user

  if (isLoginRoute) return null
  if (!isAuthed) return null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href))

  // Define unique key to restart CSS animations via React key prop
  const animKey = triggerCount.toString()

  return (
    <>
      <aside
        className="hidden lg:flex flex-col fixed z-50 transition-transform duration-300"
        style={{
          left: 0, top: 0, bottom: 0, height: '100dvh', width: 280,
          background: '#070710', borderRight: '1px solid #1a2a1a',
          overflowY: 'auto', overflowX: 'hidden',
          scrollbarWidth: 'thin', scrollbarColor: '#00ff41 #0a0a0f'
        }}
      >
        <div className="shrink-0" style={{ padding: '20px 16px', borderBottom: '1px solid #1a2a1a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 78, height: 78, borderRadius: '9999px', border: '1px solid rgba(0,255,65,0.5)', padding: 4, background: 'rgba(0,0,0,0.65)', boxShadow: '0 0 26px rgba(0,255,65,0.25)', overflow: 'hidden' }}>
              <img src="/skull.jpg" alt="operator avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px', filter: 'saturate(1.1) contrast(1.05)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', right: 2, bottom: 2, width: 12, height: 12, borderRadius: '9999px', background: '#00ff41', boxShadow: '0 0 8px #00ff41', border: '1px solid #06110a' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.12em' }}>OPERATOR</div>
              <div style={{ marginTop: 5, color: '#4d7c4d', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.displayName ?? 'NOVA_K'}</div>
              <div style={{ marginTop: 2, color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>ROLE: {roleLabel(user?.role ?? 'view')}</div>
            </div>
          </div>
        </div>

        <div className="shrink-0" style={{ padding: '10px 12px 4px', color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em' }}>
          // NAVIGATION
        </div>

        <nav className="shrink-0" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, padding: '0 10px', marginBottom: 16 }}>
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}
                style={{ padding: '8px 10px', border: `1px solid ${active ? 'rgba(0,255,65,0.5)' : '#1a2a1a'}`, color: active ? '#00ff41' : '#7a9a7a', background: active ? 'rgba(0,255,65,0.06)' : 'transparent', fontFamily: 'monospace', fontSize: 12, textDecoration: 'none', letterSpacing: '0.05em' }}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ═══ SOC TOOLKIT SECTIONS ═══ */}
        
        <div className="flex flex-col gap-2 px-3 mb-3 relative shrink-0" key={animKey}>
          {/* DEFCON */}
          <div className="border border-yellow-600/50 bg-black/60 p-2 relative toolkit-pulse-anim">
              <div className="text-[10px] text-yellow-600 mb-1 font-bold font-mono tracking-widest">// DEFCON THRESHOLD</div>
              <div className="flex justify-between text-yellow-500 text-xs font-mono">
                  <span className="opacity-20">[ 5 ]</span>
                  <span className="opacity-20">[ 4 ]</span>
                  <span className="font-black border border-yellow-500 px-1.5 bg-yellow-500/20 shadow-[0_0_8px_rgba(245,158,11,0.5)] text-yellow-300">[{">"}3{"<"}]</span>
                  <span className="opacity-20">[ 2 ]</span>
                  <span className="opacity-20">[ 1 ]</span>
              </div>
              <div className="text-[9px] font-mono text-yellow-600/80 mt-1 toolkit-fade-in-anim" style={{animationDelay: '1s'}}>STATUS: ELEVATED RISK</div>
          </div>

          {/* OSINT LOOKUP */}
          <div className="border border-green-800 bg-black/60 p-2 relative group hover:border-green-500 transition-colors duration-300">
              <div className="text-[10px] text-green-600 mb-1 font-mono tracking-wider">// OSINT LOOKUP</div>
              <div className="flex bg-[#000000] p-1 border border-green-900/50 text-[10px] text-green-400 mb-1 items-center font-mono">
                  <span className="mr-2 text-green-600">&gt;</span>
                  <span className="toolkit-typewriter" style={{animationDelay: '0.5s'}}>{osintTarget}</span>
                  <span className="ml-auto text-[9px] bg-green-900/40 border border-green-700 font-bold px-1.5 py-0.5 cursor-pointer hover:bg-green-700 text-green-400">EXEC</span>
              </div>
              <div className="text-[10px] space-y-1 toolkit-fade-in-anim font-mono" style={{animationDelay: '1.5s'}}>
                  <div className="flex justify-between items-center"><span className="text-gray-500">TARGET:</span> <span className="text-green-300">{osintTarget}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">REP:</span> <span className="text-orange-400 bg-orange-900/20 px-1 border border-orange-800">[ SUSPICIOUS ]</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">GEO:</span> <span className="text-gray-400">RU / Moscow</span></div>
              </div>
          </div>

          {/* PERIMETER SCAN */}
          <div className="border border-green-800/80 bg-black/60 p-2 relative font-mono">
              <div className="text-[10px] text-green-600 mb-1 flex justify-between tracking-wider">
                  <span>// PERIMETER SCAN</span>
              </div>
              <div className="text-[10px] space-y-1 p-1.5 bg-[#030605] border border-green-900/30">
                  <div className="toolkit-slide-up-anim text-red-500 flex justify-between items-center" style={{animationDelay: '0.2s'}}>
                      <span>TCP/22</span> <span className="bg-red-900/30 px-1 border border-red-800/50">[ OPEN ]</span> <span className="text-gray-600 text-[9px]">&gt; 10.0.1.5</span>
                  </div>
                  <div className="toolkit-slide-up-anim text-green-500 flex justify-between items-center" style={{animationDelay: '0.5s'}}>
                      <span>TCP/443</span> <span className="opacity-70 border border-transparent px-1">[ FILTER ]</span> <span className="text-gray-600 text-[9px]">&gt; 192.168.2</span>
                  </div>
                  <div className="toolkit-slide-up-anim text-gray-500 flex justify-between items-center" style={{animationDelay: '0.8s'}}>
                      <span>UDP/53</span> <span className="opacity-50 border border-transparent px-1">[ DROP ]</span> <span className="text-gray-600 text-[9px]">&gt; 8.8.8.8</span>
                  </div>
              </div>
          </div>

          {/* HASH ANALYZER — compact */}
          <div className="border border-red-900 bg-[#1e0505]/40 p-2 relative border-r-4 border-r-red-600 font-mono">
              <div className="text-[10px] text-red-500 mb-1 tracking-wider">// HASH ANALYZER</div>
              <div className="flex bg-[#000000] p-1 border border-red-950 text-[10px] text-red-500 mb-1 items-center">
                  <span className="mr-2">&gt;</span>
                  <span>{hashValue}</span>
              </div>
              <div className="text-[10px] text-red-400 font-bold toolkit-glitch-anim border border-red-500 bg-red-900/20 p-1 text-center shadow-[0_0_10px_rgba(239,68,68,0.2)]">[!] MATCH: WannaCry</div>
              <div className="text-[9px] text-red-500/80 mt-1 flex justify-between">
                  <span>SEVERITY:</span> <span className="font-bold text-red-400">CRITICAL</span>
              </div>
          </div>
        </div>

        <div className="shrink-0" style={{ marginTop: 'auto', borderTop: '1px solid #1a2a1a', padding: '14px 12px' }}>
          <button
            onClick={async () => {
              await logoutAuth()
              router.push('/')
            }}
            style={{ width: '100%', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            [ LOGOUT ]
          </button>
        </div>
      </aside>
    </>
  )
}
