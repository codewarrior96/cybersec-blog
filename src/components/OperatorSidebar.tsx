'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  alertQueue: Array<{
    id: number
    title: string
    status: 'new' | 'in_progress' | 'blocked' | 'resolved'
    priority: 'P1' | 'P2' | 'P3' | 'P4'
    ageMinutes: number
    assignee: { id: number; username: string } | null
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

function workloadColor(load: number) {
  if (load >= 8) return '#ef4444'
  if (load >= 5) return '#f59e0b'
  return '#00ff41'
}

function slaRisk(metrics: SidebarMetrics | null): { label: 'LOW' | 'MED' | 'HIGH'; color: string } {
  if (!metrics) return { label: 'LOW', color: '#64748b' }
  const breaches = metrics.shiftSnapshot.slaBreaches
  const criticalOpen = metrics.shiftSnapshot.openCritical
  const unassigned = metrics.shiftSnapshot.unassigned

  if (breaches > 0 || criticalOpen >= 4) return { label: 'HIGH', color: '#ef4444' }
  if (criticalOpen > 0 || unassigned > 0) return { label: 'MED', color: '#f59e0b' }
  return { label: 'LOW', color: '#00ff41' }
}

function dispatchQuickFilter(payload: {
  assignee?: 'all' | 'me' | 'unassigned'
  priority?: 'all' | 'P1' | 'P2' | 'P3' | 'P4'
  scrollTo?: 'alert-queue'
}) {
  window.dispatchEvent(new CustomEvent('soc_quick_filter', { detail: payload }))
}

export default function OperatorSidebar({ initialAuth = null }: OperatorSidebarProps) {
  const pathname = usePathname()
  const session = useAuthSession(initialAuth)
  const [metrics, setMetrics] = useState<SidebarMetrics | null>(null)
  const fetchSeqRef = useRef(0)

  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')
  const isAuthed = session?.authenticated === true
  const user = session?.user

  useEffect(() => {
    if (!isAuthed || isLoginRoute) return

    let alive = true
    const load = async () => {
      const fetchSeq = ++fetchSeqRef.current
      const next = await fetchSidebarMetrics()
      if (alive && fetchSeq === fetchSeqRef.current) {
        setMetrics(next)
      }
    }

    void load()
    const interval = setInterval(load, 8000)

    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [isAuthed, isLoginRoute])

  const escalationQueue = useMemo(() => {
    if (!metrics) return []
    return metrics.alertQueue.filter((row) => row.status !== 'resolved').slice(0, 3)
  }, [metrics])

  const analystCapacity = useMemo(() => {
    if (!metrics) return []
    return metrics.assignment.filter((row) => row.role !== 'viewer')
  }, [metrics])

  const overloadedCount = useMemo(() => analystCapacity.filter((row) => row.activeWorkload >= 8).length, [analystCapacity])
  const risk = slaRisk(metrics)

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
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              position: 'relative',
              width: 60,
              height: 60,
              borderRadius: '9999px',
              border: '1px solid rgba(0,255,65,0.5)',
              padding: 3,
              background: 'rgba(0,0,0,0.65)',
              boxShadow: '0 0 18px rgba(0,255,65,0.22)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/skull.jpg"
              alt="operator avatar"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '9999px',
                filter: 'saturate(1.1) contrast(1.05)',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 1,
                bottom: 1,
                width: 10,
                height: 10,
                borderRadius: '9999px',
                background: '#00ff41',
                boxShadow: '0 0 8px #00ff41',
                border: '1px solid #06110a',
              }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.12em' }}>OPERATOR</div>
            <div style={{ marginTop: 5, color: '#4d7c4d', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.displayName ?? 'Unknown'}
            </div>
            <div style={{ marginTop: 2, color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
              ROLE: {roleLabel(user?.role ?? 'viewer')}
            </div>
          </div>
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
        <div style={{ display: 'grid', gap: 6 }}>
          <SnapshotRow label="CRITICAL OPEN" value={metrics?.shiftSnapshot.openCritical ?? 0} color="#ef4444" />
          <SnapshotRow label="UNASSIGNED" value={metrics?.shiftSnapshot.unassigned ?? 0} color="#f59e0b" />
          <SnapshotRow label="SLA BREACH" value={metrics?.shiftSnapshot.slaBreaches ?? 0} color="#00ff41" />
        </div>
      </div>

      <div style={{ padding: '10px 12px', borderBottom: '1px solid #111a11' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em' }}>
            // ESCALATION QUEUE
          </div>
          <div
            style={{
              border: `1px solid ${risk.color}66`,
              color: risk.color,
              fontFamily: 'monospace',
              fontSize: 10,
              padding: '2px 6px',
            }}
          >
            SLA RISK: {risk.label}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {escalationQueue.length === 0 && (
            <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>Escalation queue sakin.</div>
          )}
          {escalationQueue.map((alert) => (
            <div
              key={alert.id}
              style={{
                border: '1px solid #1a2a1a',
                padding: '6px 8px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {alert.title}
                </div>
                <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                  age {alert.ageMinutes}m {alert.assignee ? `| ${alert.assignee.username}` : '| unassigned'}
                </div>
              </div>
              <div style={{ color: alert.priority === 'P1' ? '#ef4444' : '#f59e0b', fontFamily: 'monospace', fontSize: 11 }}>
                {alert.priority}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <button
            onClick={() => dispatchQuickFilter({ priority: 'P1', assignee: 'unassigned', scrollTo: 'alert-queue' })}
            style={quickActionButtonStyle}
          >
            [ P1+UNASSIGNED ]
          </button>
          <button
            onClick={() => dispatchQuickFilter({ priority: 'P1', assignee: 'me', scrollTo: 'alert-queue' })}
            style={quickActionButtonStyle}
          >
            [ MY P1 ]
          </button>
          <button
            onClick={() => dispatchQuickFilter({ priority: 'all', assignee: 'all', scrollTo: 'alert-queue' })}
            style={quickActionButtonStyle}
          >
            [ OPEN QUEUE ]
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>
          // ANALYST CAPACITY
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {analystCapacity.length === 0 && (
            <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>Kapasite verisi bekleniyor...</div>
          )}
          {analystCapacity.map((analyst) => {
            const barColor = workloadColor(analyst.activeWorkload)
            const barWidth = `${Math.min(100, Math.max(8, (analyst.activeWorkload / 10) * 100))}%`
            return (
              <div key={analyst.id} style={{ border: '1px solid #1a2a1a', padding: '6px 8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 5 }}>
                  <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
                    {analyst.username} ({analyst.role})
                  </span>
                  <span style={{ color: barColor, fontFamily: 'monospace', fontSize: 11 }}>{analyst.activeWorkload}</span>
                </div>
                <div style={{ height: 4, border: '1px solid #132014', background: '#0a1410' }}>
                  <div style={{ width: barWidth, height: '100%', background: barColor }} />
                </div>
              </div>
            )
          })}

          <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
            Overloaded Analysts: <span style={{ color: overloadedCount > 0 ? '#ef4444' : '#00ff41' }}>{overloadedCount}</span>
          </div>
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

const quickActionButtonStyle = {
  border: '1px solid rgba(0,255,65,0.3)',
  background: 'rgba(0,255,65,0.04)',
  color: '#00ff41',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '7px 8px',
  cursor: 'pointer',
  textAlign: 'left' as const,
}
