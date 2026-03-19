'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { logoutAuth, useAuthSession } from '@/lib/auth-client'

interface SidebarMetrics {
  shiftSnapshot: {
    openCritical: number
    unassigned: number
    slaBreaches: number
  }
  assignment: Array<{
    id: number
    username: string
    displayName: string
    role: 'admin' | 'analyst' | 'viewer'
    activeWorkload: number
  }>
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

interface OperatorSidebarProps {
  initialAuth?: boolean | null
}

const QUICK_ACTIONS = [
  { label: 'Unassigned', payload: { assignee: 'unassigned' } },
  { label: 'P1 Filter', payload: { priority: 'P1' } },
  { label: 'My Alerts', payload: { assignee: 'me' } },
]

async function fetchSidebarMetrics(): Promise<SidebarMetrics | null> {
  try {
    const response = await fetch('/api/metrics/live', { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as SidebarMetrics
  } catch {
    return null
  }
}

function roleLabel(role: string) {
  if (role === 'admin') return 'ADMIN'
  if (role === 'analyst') return 'ANALYST'
  return 'VIEWER'
}

export default function OperatorSidebar({ initialAuth = null }: OperatorSidebarProps) {
  const pathname = usePathname()
  const session = useAuthSession(initialAuth)
  const [metrics, setMetrics] = useState<SidebarMetrics | null>(null)

  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')
  const isAuthed = session?.authenticated === true
  const user = session?.user

  useEffect(() => {
    if (!isAuthed || isLoginRoute) return

    let alive = true
    const load = async () => {
      const next = await fetchSidebarMetrics()
      if (alive) {
        setMetrics(next)
      }
    }

    load()
    const interval = setInterval(load, 8000)

    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [isAuthed, isLoginRoute])

  const onCall = useMemo(() => {
    const rows = metrics?.assignment ?? []
    return rows.filter((row) => row.role !== 'viewer').slice(0, 4)
  }, [metrics])

  if (isLoginRoute) return null
  if (!isAuthed) return null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <aside
      className="hidden lg:flex"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 280,
        zIndex: 50,
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#070710',
        borderRight: '1px solid #1a2a1a',
      }}
    >
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #1a2a1a' }}>
        <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.12em' }}>
          OPERATOR
        </div>
        <div style={{ marginTop: 8, color: '#4d7c4d', fontFamily: 'monospace', fontSize: 11 }}>
          {user?.displayName ?? 'Unknown'}
        </div>
        <div style={{ marginTop: 2, color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
          ROLE: {roleLabel(user?.role ?? 'viewer')}
        </div>
      </div>

      <div style={{ padding: '10px 12px 4px', color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em' }}>
        // NAVIGATION
      </div>

      <nav style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, padding: '0 10px' }}>
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '8px 10px',
                border: `1px solid ${active ? 'rgba(0,255,65,0.5)' : '#1a2a1a'}`,
                color: active ? '#00ff41' : '#7a9a7a',
                background: active ? 'rgba(0,255,65,0.06)' : 'transparent',
                fontFamily: 'monospace',
                fontSize: 12,
                textDecoration: 'none',
                letterSpacing: '0.05em',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ marginTop: 10, padding: '10px 12px', borderTop: '1px solid #111a11', borderBottom: '1px solid #111a11' }}>
        <div style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>
          // SHIFT SNAPSHOT
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          <SnapshotRow label="CRITICAL OPEN" value={metrics?.shiftSnapshot.openCritical ?? 0} color="#ef4444" />
          <SnapshotRow label="UNASSIGNED" value={metrics?.shiftSnapshot.unassigned ?? 0} color="#f59e0b" />
          <SnapshotRow label="SLA BREACH" value={metrics?.shiftSnapshot.slaBreaches ?? 0} color="#00ff41" />
        </div>
      </div>

      <div style={{ padding: '10px 12px', borderBottom: '1px solid #111a11' }}>
        <div style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>
          // ON-CALL
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {onCall.length === 0 && (
            <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>Analist yuku bekleniyor...</div>
          )}
          {onCall.map((analyst) => (
            <div
              key={analyst.id}
              style={{
                border: '1px solid #1a2a1a',
                padding: '6px 8px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 11 }}>{analyst.username}</div>
              <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 11 }}>{analyst.activeWorkload}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>
          // QUICK ACTIONS
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('soc_quick_filter', {
                    detail: action.payload,
                  }),
                )
              }}
              style={{
                border: '1px solid rgba(0,255,65,0.3)',
                background: 'rgba(0,255,65,0.04)',
                color: '#00ff41',
                fontFamily: 'monospace',
                fontSize: 11,
                padding: '7px 8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              [ {action.label} ]
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid #1a2a1a', padding: '14px 12px' }}>
        <button
          onClick={async () => {
            await logoutAuth()
            window.location.href = '/'
          }}
          style={{
            width: '100%',
            border: '1px solid rgba(239,68,68,0.5)',
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            padding: '8px 10px',
            fontFamily: 'monospace',
            fontSize: 11,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          [ LOGOUT ]
        </button>
      </div>
    </aside>
  )
}

function SnapshotRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        border: '1px solid #1a2a1a',
        padding: '6px 8px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>{label}</span>
      <span style={{ color, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}
