'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import ThreatGlobe from '@/components/ThreatGlobe'
import { useAuthSession } from '@/lib/auth-client'
import type { AlertPriority, AlertStatus, SessionUser } from '@/lib/soc-types'

export interface PostMeta {
  slug: string
  title: string
  date: string
  tags?: string[]
  description?: string
  readingTime?: number
}

interface CVEItem {
  id: string
  description: string
  severity: string | null
  score: number | null
}

interface NewsItem {
  title: string
  source: string
}

interface CommunityPost {
  id: string | number
  title: string
  author?: string
  category?: string
  likes?: unknown[]
  comments?: unknown[]
}

interface AttackEvent {
  id: number
  time: string
  createdAt: string
  sourceIP: string
  sourceCountry: string
  targetPort: number
  type: string
  severity: 'critical' | 'high' | 'low'
}

interface AlertRecord {
  id: number
  title: string
  description: string
  status: AlertStatus
  priority: AlertPriority
  sourceIp: string | null
  sourceCountry: string | null
  attackType: string | null
  assignee: SessionUser | null
  noteCount: number
  ageMinutes: number
}

interface WorkflowMetrics {
  generatedAt: string
  shiftSnapshot: {
    openCritical: number
    unassigned: number
    slaBreaches: number
  }
  triageBoard: {
    new: number
    inProgress: number
    blocked: number
    resolved: number
  }
  sla: {
    p1FirstResponseMinutes: number
    avgResolutionMinutes: number
    breachCount: number
  }
  assignment: Array<{
    id: number
    username: string
    displayName: string
    role: 'admin' | 'analyst' | 'viewer'
    activeWorkload: number
  }>
  attack: {
    topCountries: Array<{ name: string; count: number }>
    topTags: Array<{ name: string; count: number }>
    attacksPerMinute: number
    activeIps: number
    liveDensity: number
    totalLast24h: number
  }
}

interface SOCDashboardProps {
  posts: PostMeta[]
}

const ATTACK_FEED_LIMIT = 8
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const STATUS_OPTIONS: AlertStatus[] = ['new', 'in_progress', 'blocked', 'resolved']
const PRIORITY_OPTIONS: AlertPriority[] = ['P1', 'P2', 'P3', 'P4']

function formatClock(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatSession(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function severityColor(severity: string | null) {
  const value = (severity ?? '').toUpperCase()
  if (value === 'CRITICAL') return '#ef4444'
  if (value === 'HIGH') return '#f59e0b'
  if (value === 'MEDIUM') return '#64748b'
  return '#00ff41'
}

function attackSeverityColor(value: AttackEvent['severity']) {
  if (value === 'critical') return '#ef4444'
  if (value === 'high') return '#f59e0b'
  return '#00ff41'
}

function priorityColor(value: AlertPriority) {
  if (value === 'P1') return '#ef4444'
  if (value === 'P2') return '#f59e0b'
  if (value === 'P3') return '#00ff41'
  return '#64748b'
}

function statusColor(value: AlertStatus) {
  if (value === 'new') return '#00ff41'
  if (value === 'in_progress') return '#38bdf8'
  if (value === 'blocked') return '#f59e0b'
  return '#64748b'
}

function statusLabel(value: AlertStatus) {
  if (value === 'in_progress') return 'IN PROGRESS'
  return value.toUpperCase()
}

function streamModeLabel(mode: 'connecting' | 'live' | 'degraded') {
  if (mode === 'live') return 'SSE LIVE'
  if (mode === 'degraded') return 'DEGRADED'
  return 'CONNECTING'
}

export default function SOCDashboard({ posts }: SOCDashboardProps) {
  const auth = useAuthSession(true)
  const role = auth?.user?.role ?? 'viewer'
  const canMutate = role === 'admin' || role === 'analyst'

  const [now, setNow] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [cves, setCves] = useState<CVEItem[]>([])
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [attacks, setAttacks] = useState<AttackEvent[]>([])
  const [streamMode, setStreamMode] = useState<'connecting' | 'live' | 'degraded'>('connecting')

  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null)
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [users, setUsers] = useState<WorkflowMetrics['assignment']>([])
  const [alertStatusFilter, setAlertStatusFilter] = useState<AlertStatus | 'all'>('all')
  const [alertPriorityFilter, setAlertPriorityFilter] = useState<AlertPriority | 'all'>('all')
  const [alertAssigneeFilter, setAlertAssigneeFilter] = useState<'all' | 'me' | 'unassigned'>('all')
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({})

  const [creatingAlert, setCreatingAlert] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createPriority, setCreatePriority] = useState<AlertPriority>('P2')
  const [liveAttackStats, setLiveAttackStats] = useState<{ attacksPerMinute: number; activeIps: number } | null>(null)

  const startedAtRef = useRef(Date.now())
  const metricsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attackFeedRef = useRef<HTMLDivElement | null>(null)
  const liveAttackWindowRef = useRef<Array<{ ts: number; ip: string }>>([])

  const recomputeLiveAttackStats = useCallback(() => {
    const nowTs = Date.now()
    const cutoff15m = nowTs - 15 * 60 * 1000
    const cutoff1m = nowTs - 60 * 1000

    const pruned = liveAttackWindowRef.current.filter((item) => item.ts >= cutoff15m)
    liveAttackWindowRef.current = pruned

    const attacksPerMinute = pruned.filter((item) => item.ts >= cutoff1m).length
    const activeIps = new Set(pruned.map((item) => item.ip)).size

    setLiveAttackStats({ attacksPerMinute, activeIps })
  }, [])

  const fetchCorePanels = useCallback(async () => {
    const [metricsResponse, usersResponse] = await Promise.all([
      fetch('/api/metrics/live', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
    ])

    if (metricsResponse.ok) {
      const payload = (await metricsResponse.json()) as WorkflowMetrics
      setMetrics(payload)
    }

    if (usersResponse.ok) {
      const payload = (await usersResponse.json()) as { users?: WorkflowMetrics['assignment'] }
      setUsers(payload.users ?? [])
    }
  }, [])

  const fetchAlerts = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('limit', '8')
    if (alertStatusFilter !== 'all') params.set('status', alertStatusFilter)
    if (alertPriorityFilter !== 'all') params.set('priority', alertPriorityFilter)
    if (alertAssigneeFilter !== 'all') params.set('assignee', alertAssigneeFilter)

    const response = await fetch(`/api/alerts?${params.toString()}`, { cache: 'no-store' })
    if (!response.ok) return
    const payload = (await response.json()) as { alerts?: AlertRecord[] }
    setAlerts(payload.alerts ?? [])
  }, [alertAssigneeFilter, alertPriorityFilter, alertStatusFilter])

  const refreshWorkflow = useCallback(async () => {
    await Promise.all([fetchCorePanels(), fetchAlerts()])
  }, [fetchAlerts, fetchCorePanels])

  const patchAlert = useCallback(
    async (id: number, payload: Record<string, unknown>) => {
      if (!canMutate) return
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) return
      await refreshWorkflow()
      setNoteDrafts((prev) => ({ ...prev, [id]: '' }))
    },
    [canMutate, refreshWorkflow],
  )

  const createManualAlert = useCallback(async () => {
    if (!canMutate) return
    if (!createTitle.trim() || !createDescription.trim()) return

    setCreatingAlert(true)
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDescription.trim(),
          priority: createPriority,
        }),
      })
      if (!response.ok) return
      setCreateTitle('')
      setCreateDescription('')
      setCreatePriority('P2')
      await refreshWorkflow()
    } finally {
      setCreatingAlert(false)
    }
  }, [canMutate, createDescription, createPriority, createTitle, refreshWorkflow])

  const tickerText = newsItems.length
    ? newsItems.slice(0, 10).map((item) => `[${item.source}] ${item.title}`).join('   |   ')
    : 'LIVE INTEL FEED INITIALIZING...'

  const countryBars = metrics?.attack.topCountries ?? []
  const tagBars = metrics?.attack.topTags ?? []
  const streamLabel = streamModeLabel(streamMode)
  const streamColor = streamMode === 'live' ? '#00ff41' : streamMode === 'degraded' ? '#f59e0b' : '#64748b'

  const activeDayIndex = useMemo(() => {
    const source = now ?? new Date()
    const day = source.getDay()
    return day === 0 ? 6 : day - 1
  }, [now])

  const weeklyHeights = useMemo(
    () => DAY_LABELS.map((_, index) => (index === activeDayIndex ? 92 : 52)),
    [activeDayIndex],
  )

  useEffect(() => {
    setNow(new Date())
    setElapsed(0)
    const interval = setInterval(() => {
      setNow(new Date())
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadIntelPanels = useCallback(async () => {
    await Promise.all([
      fetch('/api/cybernews')
        .then((response) => response.json())
        .then((payload: { items?: NewsItem[] }) => setNewsItems(payload.items ?? []))
        .catch(() => {}),
      fetch('/api/cves?days=1')
        .then((response) => response.json())
        .then((payload: { cves?: CVEItem[] }) => setCves((payload.cves ?? []).slice(0, 5)))
        .catch(() => {}),
    ])
  }, [])

  useEffect(() => {
    void loadIntelPanels()
    const interval = setInterval(() => {
      void loadIntelPanels()
    }, 60_000)
    return () => clearInterval(interval)
  }, [loadIntelPanels])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('community_posts')
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        setCommunityPosts((parsed as CommunityPost[]).slice(0, 4))
      }
    } catch {
      // ignore localStorage failures
    }
  }, [])

  useEffect(() => {
    refreshWorkflow().catch(() => {})
    const interval = setInterval(() => {
      void refreshWorkflow()
    }, 5_000)
    return () => clearInterval(interval)
  }, [refreshWorkflow])

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])

  useEffect(() => {
    let disposed = false
    const source = new EventSource('/api/live-attacks')

    source.addEventListener('ready', () => {
      if (disposed) return
      setStreamMode('live')
    })

    source.addEventListener('attack', (event) => {
      if (disposed) return
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as AttackEvent
        setAttacks((prev) => [...prev, payload].slice(-ATTACK_FEED_LIMIT))
        setStreamMode('live')

        const parsedTs = new Date(payload.createdAt).getTime()
        liveAttackWindowRef.current.push({
          ts: Number.isFinite(parsedTs) ? parsedTs : Date.now(),
          ip: payload.sourceIP,
        })
        recomputeLiveAttackStats()

        if (metricsRefreshTimerRef.current) {
          clearTimeout(metricsRefreshTimerRef.current)
        }
        metricsRefreshTimerRef.current = setTimeout(() => {
          void refreshWorkflow()
        }, 700)
      } catch {
        // ignore malformed payloads
      }
    })

    source.onerror = () => {
      if (disposed) return
      setStreamMode('degraded')
    }

    return () => {
      disposed = true
      if (metricsRefreshTimerRef.current) {
        clearTimeout(metricsRefreshTimerRef.current)
      }
      source.close()
    }
  }, [recomputeLiveAttackStats, refreshWorkflow])

  useEffect(() => {
    const interval = setInterval(() => {
      if (liveAttackWindowRef.current.length === 0) return
      recomputeLiveAttackStats()
    }, 2_000)
    return () => clearInterval(interval)
  }, [recomputeLiveAttackStats])

  useEffect(() => {
    const feed = attackFeedRef.current
    if (!feed) return
    feed.scrollTop = feed.scrollHeight
  }, [attacks])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        assignee?: 'all' | 'me' | 'unassigned'
        priority?: AlertPriority | 'all'
        scrollTo?: 'alert-queue'
      }>).detail
      if (!detail) return
      if (detail.assignee) setAlertAssigneeFilter(detail.assignee)
      if (detail.priority) setAlertPriorityFilter(detail.priority)
      if (detail.scrollTo === 'alert-queue') {
        const queue = document.getElementById('alert-queue')
        queue?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.addEventListener('soc_quick_filter', handler)
    return () => window.removeEventListener('soc_quick_filter', handler)
  }, [])

  const effectiveActiveIps = liveAttackStats?.activeIps ?? metrics?.attack.activeIps ?? 0
  const effectiveAttacksPerMinute = liveAttackStats?.attacksPerMinute ?? metrics?.attack.attacksPerMinute ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#06070d' }}>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .soc-frame {
          border: 1px solid #1a2a1a;
          background: #07070f;
        }
        .soc-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid #102018;
        }
        .soc-head-title {
          font-size: 11px;
          font-family: monospace;
          color: #4d7c4d;
          letter-spacing: 0.2em;
        }
        .soc-grid-3 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .soc-split-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: start;
        }
        .soc-workflow-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          padding: 10px;
        }
        .soc-workflow-card {
          border: 1px solid #1a2a1a;
          background: #06060d;
          padding: 8px;
          min-height: 80px;
        }
        .soc-workflow-title {
          color: #4d7c4d;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          margin-bottom: 8px;
        }
        .soc-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0;
          border: 1px solid #1a2a1a;
          border-top: none;
        }
        .soc-weekly-track {
          height: 80px;
          display: flex;
          gap: 2px;
          min-width: 640px;
        }
        @media (min-width: 1024px) {
          .soc-grid-3 {
            grid-template-columns: 1fr 1fr 1fr;
          }
          .soc-split-grid {
            grid-template-columns: minmax(0, 60fr) minmax(0, 40fr);
          }
          .soc-workflow-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .soc-workflow-card.alert-queue {
            grid-column: span 2;
          }
          .soc-stats-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
      <div style={{ borderBottom: '1px solid #1a2a1a', overflow: 'hidden', background: '#050509' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', gap: 8 }}>
          <span style={{ color: '#f59e0b', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.12em' }}>LIVE INTEL</span>
          <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'inline-block', animation: 'marquee 42s linear infinite' }}>
              <span style={{ color: '#00ff41', fontSize: 10, fontFamily: 'monospace' }}>{tickerText}   |   {tickerText}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 12px 24px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 42, lineHeight: 1, letterSpacing: '0.06em', margin: 0 }}>
              OPERATOR DASHBOARD
            </h1>
            <div style={{ marginTop: 8, color: '#4d7c4d', fontFamily: 'monospace', fontSize: 13 }}>
              {now ? formatClock(now) : 'Yukleniyor...'}
            </div>
            <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 13, marginTop: 4 }}>
              {auth?.user?.username ?? 'operator'}@breach-terminal~$ {streamLabel}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, auto))', gap: 6 }}>
            <TopBadge label="ONLINE" value="" color="#00ff41" />
            <TopBadge label="STREAM" value={streamLabel} color={streamColor} />
            <TopBadge label="CVE TODAY" value={String(cves.length)} color="#ef4444" />
            <TopBadge label="SESSION" value={formatSession(elapsed)} color="#00ff41" />
          </div>
        </div>

        <div className="soc-grid-3">
          <Frame title="// SON YAZILAR" right={<Link href="/blog" style={tinyLinkStyle}>TUMU</Link>}>
            <div style={{ display: 'grid', gap: 6 }}>
              {posts.slice(0, 4).map((post) => (
                <div key={post.slug} style={{ borderBottom: '1px solid #102018', paddingBottom: 6 }}>
                  <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 12 }}>{post.title}</div>
                  <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>{post.date}</div>
                </div>
              ))}
            </div>
          </Frame>

          <Frame title="// CVE RADAR" right={<Link href="/cve-radar" style={tinyLinkStyle}>TUM CVELER</Link>}>
            <div style={{ display: 'grid', gap: 6 }}>
              {cves.map((item) => (
                <div key={item.id} style={{ borderBottom: '1px solid #102018', paddingBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 11 }}>{item.id}</div>
                    <div style={{ color: severityColor(item.severity), fontFamily: 'monospace', fontSize: 11 }}>
                      {(item.score ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>
                    {item.description.slice(0, 90)}...
                  </div>
                </div>
              ))}
            </div>
          </Frame>

          <Frame title="// COMMUNITY" right={<Link href="/community" style={tinyLinkStyle}>TUM POSTLAR</Link>}>
            <div style={{ display: 'grid', gap: 6 }}>
              {communityPosts.length === 0 && (
                <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>Henuz community post yok.</div>
              )}
              {communityPosts.slice(0, 4).map((item) => (
                <div key={item.id} style={{ borderBottom: '1px solid #102018', paddingBottom: 6 }}>
                  <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>{item.title}</div>
                  <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                    {item.author ?? 'ghost'} {item.category ? `@ ${item.category}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </Frame>
        </div>

        <div className="soc-split-grid">
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div className="soc-frame">
              <div className="soc-head">
                <span className="soc-head-title">// SALDIRI ISTIHBARATI</span>
                <span style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 10 }}>
                  LIVE DENSITY {metrics?.attack.liveDensity ?? 0}%
                </span>
              </div>
              <div style={{ padding: 10 }}>
                <ThreatGlobe countries={countryBars} attacks={attacks} />

                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {countryBars.map((country) => {
                    const max = Math.max(...countryBars.map((row) => row.count), 1)
                    const width = `${Math.max(6, (country.count / max) * 100)}%`
                    return (
                      <div key={country.name} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 34px', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{country.name}</span>
                        <div style={{ height: 8, border: '1px solid #132014', background: '#0a1410' }}>
                          <div style={{ width, height: '100%', background: 'linear-gradient(90deg, #00ff41, #f59e0b)' }} />
                        </div>
                        <span style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 11 }}>{country.count}</span>
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {tagBars.map((tag) => (
                    <span
                      key={tag.name}
                      style={{
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.4)',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        padding: '2px 6px',
                      }}
                    >
                      {tag.name} ({tag.count})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="soc-frame">
              <div className="soc-head">
                <span className="soc-head-title">// CANLI SALDIRI AKISI</span>
                <span
                  style={{
                    color: streamColor,
                    border: `1px solid ${streamColor}66`,
                    padding: '1px 6px',
                    fontFamily: 'monospace',
                    fontSize: 10,
                  }}
                >
                  {streamLabel}
                </span>
              </div>
              <div ref={attackFeedRef} style={{ height: 275, overflowY: 'auto' }}>
                {attacks.length === 0 && (
                  <div style={{ padding: 12, color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>
                    Canli akis bekleniyor...
                  </div>
                )}
                {attacks.map((attack, index) => (
                  <div
                    key={`${attack.id}-${attack.time}`}
                    style={{
                      padding: '6px 10px',
                      display: 'grid',
                      gridTemplateColumns: '62px auto 1fr auto',
                      gap: 6,
                      alignItems: 'center',
                      borderBottom: '1px solid #0d1410',
                      animation: index === attacks.length - 1 ? 'slideIn 0.25s ease-out' : undefined,
                    }}
                  >
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{attack.time}</span>
                    <span
                      style={{
                        color: attackSeverityColor(attack.severity),
                        border: `1px solid ${attackSeverityColor(attack.severity)}55`,
                        padding: '1px 6px',
                        fontFamily: 'monospace',
                        fontSize: 11,
                      }}
                    >
                      {attack.type}
                    </span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
                      {attack.sourceIP} : {attack.targetPort}
                    </span>
                    <span style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 11 }}>{attack.sourceCountry}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="soc-frame" id="alert-workflow-panel">
            <div className="soc-workflow-grid">
              <div className="soc-workflow-card alert-queue" id="alert-queue">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div className="soc-workflow-title">ALERT QUEUE</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <select value={alertStatusFilter} onChange={(event) => setAlertStatusFilter(event.target.value as AlertStatus | 'all')} style={tinySelectStyle}>
                      <option value="all">Status: all</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <select value={alertPriorityFilter} onChange={(event) => setAlertPriorityFilter(event.target.value as AlertPriority | 'all')} style={tinySelectStyle}>
                      <option value="all">Priority: all</option>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                    <select value={alertAssigneeFilter} onChange={(event) => setAlertAssigneeFilter(event.target.value as 'all' | 'me' | 'unassigned')} style={tinySelectStyle}>
                      <option value="all">Assignee: all</option>
                      <option value="me">mine</option>
                      <option value="unassigned">unassigned</option>
                    </select>
                  </div>
                </div>

                {canMutate && (
                  <div style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 90px auto', gap: 6 }}>
                    <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Yeni alert basligi" style={tinyInputStyle} />
                    <input value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="Kisa aciklama" style={tinyInputStyle} />
                    <select value={createPriority} onChange={(event) => setCreatePriority(event.target.value as AlertPriority)} style={tinySelectStyle}>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => void createManualAlert()} disabled={creatingAlert} style={tinyActionButtonStyle}>
                      {creatingAlert ? '...' : '+ ALERT'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 6, maxHeight: 330, overflowY: 'auto' }}>
                  {alerts.length === 0 && (
                    <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11, padding: 6 }}>Alert kuyrugu bos.</div>
                  )}
                  {alerts.map((alert) => (
                    <div key={alert.id} style={{ border: '1px solid #1a2a1a', padding: 8, display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>{alert.title}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ color: priorityColor(alert.priority), fontFamily: 'monospace', fontSize: 11 }}>{alert.priority}</span>
                          <span style={{ color: statusColor(alert.status), fontFamily: 'monospace', fontSize: 11 }}>{statusLabel(alert.status)}</span>
                        </div>
                      </div>
                      <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>{alert.description}</div>
                      <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 10 }}>
                        {alert.sourceCountry ?? '-'} {alert.sourceIp ? `| ${alert.sourceIp}` : ''} | age: {alert.ageMinutes}m | notes: {alert.noteCount}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                        <select value={alert.status} onChange={(event) => void patchAlert(alert.id, { status: event.target.value })} disabled={!canMutate} style={tinySelectStyle}>
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <select value={alert.priority} onChange={(event) => void patchAlert(alert.id, { priority: event.target.value })} disabled={!canMutate} style={tinySelectStyle}>
                          {PRIORITY_OPTIONS.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                        <select
                          value={alert.assignee?.id ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            void patchAlert(alert.id, { assigneeId: value ? Number(value) : null })
                          }}
                          disabled={!canMutate}
                          style={tinySelectStyle}
                        >
                          <option value="">unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.username}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6 }}>
                        <input
                          value={noteDrafts[alert.id] ?? ''}
                          onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [alert.id]: event.target.value }))}
                          placeholder="Note..."
                          disabled={!canMutate}
                          style={tinyInputStyle}
                        />
                        <button onClick={() => void patchAlert(alert.id, { note: noteDrafts[alert.id] ?? '' })} disabled={!canMutate || !(noteDrafts[alert.id] ?? '').trim()} style={tinyActionButtonStyle}>
                          NOTE
                        </button>
                        <button onClick={() => void patchAlert(alert.id, { claim: true })} disabled={!canMutate} style={tinyActionButtonStyle}>
                          CLAIM
                        </button>
                        <button onClick={() => void patchAlert(alert.id, { resolve: true })} disabled={!canMutate} style={tinyDangerButtonStyle}>
                          RESOLVE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="soc-workflow-card">
                <div className="soc-workflow-title">TRIAGE BOARD</div>
                <GridTwo
                  left={<TriageStat label="NEW" value={metrics?.triageBoard.new ?? 0} color="#00ff41" />}
                  right={<TriageStat label="IN_PROGRESS" value={metrics?.triageBoard.inProgress ?? 0} color="#38bdf8" />}
                />
                <GridTwo
                  left={<TriageStat label="BLOCKED" value={metrics?.triageBoard.blocked ?? 0} color="#f59e0b" />}
                  right={<TriageStat label="RESOLVED" value={metrics?.triageBoard.resolved ?? 0} color="#64748b" />}
                />
              </div>

              <div className="soc-workflow-card">
                <div className="soc-workflow-title">SLA WIDGET</div>
                <MetricRow label="P1 First Response" value={`${(metrics?.sla.p1FirstResponseMinutes ?? 0).toFixed(1)}m`} />
                <MetricRow label="Avg Resolution" value={`${(metrics?.sla.avgResolutionMinutes ?? 0).toFixed(1)}m`} />
                <MetricRow label="Breaches" value={String(metrics?.sla.breachCount ?? 0)} valueColor="#ef4444" />
              </div>

              <div className="soc-workflow-card">
                <div className="soc-workflow-title">ASSIGNMENT PANEL</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(metrics?.assignment ?? users).slice(0, 6).map((user) => (
                    <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
                        {user.username} ({user.role})
                      </span>
                      <span style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 11 }}>{user.activeWorkload}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="soc-stats-grid">
          {[
            { label: 'WRITEUP', value: posts.length, color: '#00ff41' },
            { label: 'CVE BUGUN', value: cves.length, color: '#ef4444' },
            { label: 'AKTIF IP', value: effectiveActiveIps, color: '#00ff41' },
            { label: 'ATAK / DK', value: effectiveAttacksPerMinute, color: '#f59e0b' },
          ].map((item) => (
            <div key={item.label} style={{ padding: 18, borderTop: '1px solid #1a2a1a', borderRight: '1px solid #1a2a1a', textAlign: 'center' }}>
              <div style={{ color: item.color, fontFamily: 'monospace', fontWeight: 700, fontSize: 34 }}>{item.value.toLocaleString()}</div>
              <div style={{ color: '#4d7c4d', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div className="soc-frame" style={{ padding: 10 }}>
          <div className="soc-head-title" style={{ marginBottom: 8 }}>
            // HAFTALIK AKTIVITE
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div className="soc-weekly-track">
              {DAY_LABELS.map((label, index) => {
                const isToday = index === activeDayIndex
                return (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${weeklyHeights[index]}%`,
                        background: isToday ? '#f59e0b' : '#00ff41',
                        opacity: isToday ? 1 : 0.62,
                        transform: isToday ? 'translateY(-8px)' : 'translateY(0)',
                        border: isToday ? '1px solid rgba(245,158,11,0.65)' : '1px solid rgba(0,255,65,0.16)',
                        boxShadow: isToday ? '0 0 14px rgba(245,158,11,0.45)' : 'none',
                        transition: 'all 220ms ease',
                        position: 'relative',
                        zIndex: isToday ? 2 : 1,
                      }}
                    />
                    <span style={{ color: isToday ? '#f59e0b' : '#4d7c4d', fontFamily: 'monospace', fontSize: 10 }}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Frame({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="soc-frame">
      <div className="soc-head">
        <span className="soc-head-title">{title}</span>
        {right}
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  )
}

function TopBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: `1px solid ${color}55`, color, padding: '5px 8px', fontFamily: 'monospace', fontSize: 11 }}>
      {label}
      {value ? `: ${value}` : ''}
    </div>
  )
}

function GridTwo({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

function TriageStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ border: '1px solid #1a2a1a', padding: 8 }}>
      <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>{label}</div>
      <div style={{ color, fontFamily: 'monospace', fontSize: 22, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderBottom: '1px solid #112015', padding: '6px 0' }}>
      <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor ?? '#00ff41', fontFamily: 'monospace', fontSize: 11 }}>{value}</span>
    </div>
  )
}

const tinyLinkStyle: CSSProperties = {
  color: '#00ff41',
  fontFamily: 'monospace',
  fontSize: 11,
  textDecoration: 'none',
}

const tinySelectStyle: CSSProperties = {
  border: '1px solid #1a2a1a',
  background: '#05050a',
  color: '#94a3b8',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '4px 6px',
}

const tinyInputStyle: CSSProperties = {
  border: '1px solid #1a2a1a',
  background: '#05050a',
  color: '#00ff41',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '4px 6px',
}

const tinyActionButtonStyle: CSSProperties = {
  border: '1px solid rgba(0,255,65,0.45)',
  background: 'rgba(0,255,65,0.07)',
  color: '#00ff41',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '4px 6px',
  cursor: 'pointer',
}

const tinyDangerButtonStyle: CSSProperties = {
  border: '1px solid rgba(239,68,68,0.45)',
  background: 'rgba(239,68,68,0.07)',
  color: '#ef4444',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '4px 6px',
  cursor: 'pointer',
}
