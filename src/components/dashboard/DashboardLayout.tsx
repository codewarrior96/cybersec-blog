'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AttackEvent } from '@/lib/dashboard-types'
import AttackReportModal from '@/components/dashboard/AttackReportModal'
import CriticalAlertPanel from '@/components/dashboard/CriticalAlertPanel'
import CriticalOverlayFx from '@/components/dashboard/CriticalOverlayFx'
import { useSocRuntime } from '@/lib/soc-runtime/use-soc-runtime'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'
import CountUp from '@/components/CountUp'
import MatrixRain from '@/components/MatrixRain'

type RegionFilter = 'all' | 'americas' | 'emea' | 'apac'
type SeverityFilter = 'all' | AttackEvent['severity']

interface DonutSegment {
  label: string
  value: number
  color: string
}

const COUNTRY_COORDS: Record<string, { x: number; y: number }> = {
  'united states': { x: 21, y: 36 },
  usa: { x: 21, y: 36 },
  canada: { x: 18, y: 24 },
  mexico: { x: 18, y: 46 },
  brazil: { x: 32, y: 69 },
  argentina: { x: 30, y: 82 },
  uk: { x: 45, y: 28 },
  'united kingdom': { x: 45, y: 28 },
  france: { x: 47, y: 33 },
  germany: { x: 49, y: 31 },
  italy: { x: 50, y: 38 },
  spain: { x: 45, y: 38 },
  turkey: { x: 55, y: 37 },
  russia: { x: 63, y: 22 },
  ukraine: { x: 54, y: 30 },
  india: { x: 67, y: 45 },
  china: { x: 72, y: 39 },
  japan: { x: 82, y: 36 },
  'south korea': { x: 79, y: 36 },
  singapore: { x: 72, y: 58 },
  indonesia: { x: 74, y: 62 },
  australia: { x: 82, y: 76 },
  'south africa': { x: 53, y: 74 },
  egypt: { x: 53, y: 44 },
  nigeria: { x: 49, y: 56 },
}

const INCIDENT_COLORS = ['#38bdf8', '#f59e0b', '#22d3ee', '#fb7185', '#14b8a6', '#6366f1']
const TARGET_HUB = { x: 55, y: 46 }

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function getCountryRegion(country: string): RegionFilter {
  const key = country.toLowerCase()
  if (
    ['united states', 'usa', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'colombia'].some((item) =>
      key.includes(item),
    )
  ) {
    return 'americas'
  }

  if (
    ['uk', 'united kingdom', 'france', 'germany', 'spain', 'italy', 'russia', 'turkey', 'ukraine', 'africa'].some(
      (item) => key.includes(item),
    )
  ) {
    return 'emea'
  }

  return 'apac'
}

function normalizeIncidentType(rawType: string): string {
  const type = rawType.toLowerCase()
  if (type.includes('ddos') || type.includes('dos') || type.includes('flood')) return 'DDoS'
  if (type.includes('phishing') || type.includes('spear')) return 'Phishing'
  if (type.includes('ransom')) return 'Ransomware'
  if (type.includes('breach') || type.includes('leak') || type.includes('exfil')) return 'Data Breach'
  if (type.includes('scan') || type.includes('recon') || type.includes('port')) return 'Recon'
  if (type.includes('sql') || type.includes('rce') || type.includes('xss')) return 'Exploit'
  return 'Other'
}

function resolveCountryCoords(country: string) {
  const normalized = country.toLowerCase().trim()
  if (COUNTRY_COORDS[normalized]) return COUNTRY_COORDS[normalized]

  const found = Object.entries(COUNTRY_COORDS).find(([name]) =>
    normalized.includes(name) || name.includes(normalized),
  )

  return found ? found[1] : null
}

function severityGlow(severity: AttackEvent['severity']) {
  if (severity === 'critical') return '#fb7185'
  if (severity === 'high') return '#f59e0b'
  return '#22d3ee'
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const bigint = Number.parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildTrajectoryStyle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  severity: AttackEvent['severity'],
  index: number,
): CSSProperties {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const color = severityGlow(severity)

  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${Math.max(4, length)}%`,
    transform: `translateY(-50%) rotate(${angle}deg)`,
    transformOrigin: '0 50%',
    background: `linear-gradient(90deg, ${hexToRgba(color, 0.2)} 0%, ${hexToRgba(color, 0.92)} 38%, transparent 100%)`,
    boxShadow: `0 0 9px ${hexToRgba(color, 0.62)}`,
    animation: `soc-trajectory 2.9s ease-in-out ${index * 0.12}s infinite`,
  }
}

function GlassCard({
  title,
  right,
  children,
  className = '',
}: {
  title: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`relative rounded-none border-[1.5px] border-cyan-500/30 bg-[#030a11]/80 backdrop-blur-md shadow-[inset_0_0_20px_rgba(34,211,238,0.05),0_0_15px_rgba(0,0,0,0.6)] ${className}`}
    >
      {/* Sci-fi Corner Brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-[2.5px] border-l-[2.5px] border-cyan-400/90 -translate-x-[1.5px] -translate-y-[1.5px]" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-[2.5px] border-r-[2.5px] border-cyan-400/90 translate-x-[1.5px] -translate-y-[1.5px]" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-[2.5px] border-l-[2.5px] border-cyan-400/90 -translate-x-[1.5px] translate-y-[1.5px]" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-[2.5px] border-r-[2.5px] border-cyan-400/90 translate-x-[1.5px] translate-y-[1.5px]" />
      
      {/* Scanline pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(transparent_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px]" />

      <header className="relative flex items-center justify-between border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/50 to-transparent px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-50 flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          {title}
        </h2>
        {right}
      </header>
      <div className="relative p-4 z-10">{children}</div>
    </section>
  )
}

function MetricTile({ label, value, tone, isCountUp = true, suffix = '' }: { label: string; value: number | string; tone: string; isCountUp?: boolean; suffix?: string }) {
  return (
    <article className="group relative overflow-hidden rounded-md border border-cyan-500/20 bg-[#06101a]/80 px-3 py-3 transition-colors hover:bg-cyan-950/40 hover:border-cyan-400/40">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
      
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
        {label}
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400 text-[8px] tracking-widest font-mono">ACTV</span>
      </p>
      <p className={`relative mt-2 text-2xl font-bold tabular-nums tracking-wide drop-shadow-[0_0_8px_currentColor] ${tone}`}>
        {isCountUp && typeof value === 'number' ? <CountUp to={value} suffix={suffix} /> : value}
      </p>
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-cyan-400 to-transparent transition-all duration-300 group-hover:w-full" />
    </article>
  )
}

export default function DashboardLayout() {
  const { mounted, snapshot, actions } = useSocRuntime({
    overlayDurationMs: CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  })

  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [timeWindowHours, setTimeWindowHours] = useState(24)
  const [timelineCursor, setTimelineCursor] = useState(72)

  const attacks = [...snapshot.attacks].reverse()

  const filteredAttacks = useMemo(() => {
    const now = Date.now()
    const cutoff = now - timeWindowHours * 60 * 60 * 1000

    return attacks.filter((attack) => {
      const createdAt = new Date(attack.createdAt).getTime()
      const inWindow = Number.isFinite(createdAt) && createdAt >= cutoff
      if (!inWindow) return false

      if (severityFilter !== 'all' && attack.severity !== severityFilter) return false
      if (regionFilter !== 'all' && getCountryRegion(attack.sourceCountry) !== regionFilter) return false

      const incidentType = normalizeIncidentType(attack.type)
      if (typeFilter !== 'all' && incidentType !== typeFilter) return false

      return true
    })
  }, [attacks, regionFilter, severityFilter, timeWindowHours, typeFilter])

  const typeOptions = useMemo(() => {
    const unique = Array.from(new Set(attacks.map((attack) => normalizeIncidentType(attack.type))))
    return ['all', ...unique]
  }, [attacks])

  const countryBreakdown = useMemo(() => {
    const counts = new Map<string, number>()

    for (const attack of filteredAttacks) {
      counts.set(attack.sourceCountry, (counts.get(attack.sourceCountry) ?? 0) + 1)
    }

    if (counts.size === 0 && snapshot.metrics?.attack.topCountries?.length) {
      return snapshot.metrics.attack.topCountries.map((item) => ({ name: item.name, count: item.count }))
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
  }, [filteredAttacks, snapshot.metrics?.attack.topCountries])

  const topCountries = countryBreakdown.slice(0, 5)

  const incidentTypeBreakdown = useMemo<DonutSegment[]>(() => {
    const counts = new Map<string, number>()

    for (const attack of filteredAttacks) {
      const label = normalizeIncidentType(attack.type)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }

    const ordered = Array.from(counts.entries())
      .map(([label, value], index) => ({
        label,
        value,
        color: INCIDENT_COLORS[index % INCIDENT_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)

    return ordered.slice(0, 6)
  }, [filteredAttacks])

  const donutGradient = useMemo(() => {
    if (incidentTypeBreakdown.length === 0) {
      return 'conic-gradient(#0a1929 0% 100%)'
    }

    const total = incidentTypeBreakdown.reduce((sum, item) => sum + item.value, 0)
    let cursor = 0
    const slices: string[] = []

    for (const segment of incidentTypeBreakdown) {
      const pct = (segment.value / Math.max(1, total)) * 100
      const next = cursor + pct
      slices.push(`${segment.color} ${cursor}% ${next}%`)
      cursor = next
    }

    return `conic-gradient(${slices.join(',')})`
  }, [incidentTypeBreakdown])

  const geoPoints = useMemo(() => {
    return filteredAttacks
      .slice(0, 40)
      .map((attack) => {
        const point = resolveCountryCoords(attack.sourceCountry)
        if (!point) return null
        return { attack, point }
      })
      .filter((value): value is { attack: AttackEvent; point: { x: number; y: number } } => value !== null)
  }, [filteredAttacks])

  const trajectoryPoints = geoPoints.slice(0, 24)

  const timelineSeries = useMemo(() => {
    const bucketCount = 16
    const buckets = Array.from({ length: bucketCount }, () => 0)
    const now = Date.now()
    const totalWindowMinutes = Math.max(60, timeWindowHours * 60)
    const bucketSpan = totalWindowMinutes / bucketCount

    for (const attack of filteredAttacks) {
      const diffMs = now - new Date(attack.createdAt).getTime()
      if (!Number.isFinite(diffMs) || diffMs < 0) continue
      const diffMin = diffMs / 60_000
      if (diffMin > totalWindowMinutes) continue
      const rawIndex = bucketCount - 1 - Math.floor(diffMin / bucketSpan)
      const index = Math.max(0, Math.min(bucketCount - 1, rawIndex))
      const weight = attack.severity === 'critical' ? 3 : attack.severity === 'high' ? 2 : 1
      buckets[index] += weight
    }

    const max = Math.max(1, ...buckets)
    return buckets.map((value) => Math.max(8, Math.round((value / max) * 100)))
  }, [filteredAttacks, timeWindowHours])

  const timelineThreshold = Math.round((timelineCursor / 100) * (timelineSeries.length - 1))

  const totalIncidents = filteredAttacks.length
  const ongoingIncidents = snapshot.metrics?.triageBoard.inProgress ?? snapshot.alertCount
  const resolvedIncidents = snapshot.metrics?.triageBoard.resolved ?? 0
  const criticalIncidents = filteredAttacks.filter((attack) => attack.severity === 'critical').length
  const attacksPerMinute = snapshot.metrics?.attack.attacksPerMinute ?? 0
  const mttr = Math.max(1, Math.round(snapshot.metrics?.sla.avgResolutionMinutes ?? 0))
  const mttd = Math.max(1, Number((60 / Math.max(1, attacksPerMinute)).toFixed(1)))
  const activeIps = snapshot.metrics?.attack.activeIps ?? new Set(filteredAttacks.map((attack) => attack.sourceIP)).size

  const liveFeed = filteredAttacks.slice(0, 40)
  const countryTotal = Math.max(1, countryBreakdown.reduce((sum, item) => sum + item.count, 0))

  const healthScore = Math.max(
    12,
    Math.min(
      99,
      Math.round(
        96 -
          criticalIncidents * 3.6 -
          (snapshot.metrics?.attack.liveDensity ?? 0) * 4.1 -
          ongoingIncidents * 0.4,
      ),
    ),
  )

  if (!mounted) return null

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#02060c] text-slate-100 font-sans">
      {/* Deep Cyberpunk Backgrounds */}
      <div className="absolute inset-0 z-0 opacity-15 mix-blend-screen pointer-events-none">
        <MatrixRain />
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 [background:radial-gradient(circle_at_12%_18%,rgba(14,165,233,0.18),transparent_40%),radial-gradient(circle_at_78%_24%,rgba(245,158,11,0.15),transparent_35%),linear-gradient(180deg,transparent_0%,rgba(2,6,12,0.8)_80%,#02060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 opacity-30 [background:linear-gradient(to_right,rgba(56,189,248,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      
      {/* Global CRT subtle line */}
      <div className="pointer-events-none absolute inset-0 z-50 mix-blend-overlay opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px]" />

      {snapshot.overlayActive ? <CriticalOverlayFx cycle={snapshot.overlayCycle} /> : null}

      <div className="relative z-10 mx-auto flex w-full max-w-[1700px] flex-col gap-4 p-3 md:p-5">
        <GlassCard
          title="Sentinel Prime SOC Matrix"
          right={
            <div className="flex items-center gap-3 text-[10px] font-mono tracking-wider">
              <button
                type="button"
                className="group relative rounded border border-cyan-400/30 bg-cyan-950/20 px-3 py-1.5 text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-400/20 hover:text-cyan-50"
                onClick={() => void actions.refreshMetrics()}
              >
                <div className="absolute inset-0 bg-cyan-400/20 opacity-0 group-hover:animate-pulse group-hover:opacity-100" />
                SYNC METRICS
              </button>
              <button
                type="button"
                className="group relative rounded border border-amber-400/30 bg-amber-950/20 px-3 py-1.5 text-amber-200 transition-colors hover:border-amber-400 hover:bg-amber-400/20 hover:text-amber-50"
                onClick={() => void actions.refreshSummary()}
              >
                <div className="absolute inset-0 bg-amber-400/20 opacity-0 group-hover:animate-pulse group-hover:opacity-100" />
                SYNC INCIDENTS
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <MetricTile label="Health Score" value={healthScore} suffix="/100" tone="text-cyan-300" />
            <MetricTile label="Total Incidents" value={totalIncidents} tone="text-slate-100" />
            <MetricTile label="Resolved" value={resolvedIncidents} tone="text-emerald-300" />
            <MetricTile label="Ongoing" value={ongoingIncidents} tone="text-amber-300" />
            <MetricTile label="Critical" value={criticalIncidents} tone="text-rose-400" />
            <MetricTile label="Threats / Min" value={attacksPerMinute} tone="text-sky-300" />
          </div>
        </GlassCard>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <GlassCard title="Filter Control">
            <div className="space-y-6 text-sm">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date Range (hours)</p>
                <div className="relative group">
                  <input
                    type="range"
                    min={1}
                    max={72}
                    value={timeWindowHours}
                    onChange={(event) => setTimeWindowHours(Number(event.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <div className="absolute top-1/2 left-0 h-1.5 rounded-full bg-cyan-400 pointer-events-none" style={{ width: `${(timeWindowHours / 72) * 100}%` }} />
                </div>
                <p className="text-xs font-mono text-cyan-300">T-MINUS {timeWindowHours} HOURS</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Region</p>
                <div className="relative">
                  <select
                    value={regionFilter}
                    onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
                    className="w-full appearance-none rounded border border-cyan-800/80 bg-[#05111d] px-3 py-2.5 text-xs font-mono text-cyan-100 outline-none transition-colors hover:border-cyan-500/80 focus:border-cyan-400"
                  >
                    <option value="all">ALL REGIONS</option>
                    <option value="americas">AMERICAS</option>
                    <option value="emea">EMEA</option>
                    <option value="apac">APAC</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-500" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Severity</p>
                <div className="relative">
                  <select
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
                    className="w-full appearance-none rounded border border-cyan-800/80 bg-[#05111d] px-3 py-2.5 text-xs font-mono text-cyan-100 outline-none transition-colors hover:border-cyan-500/80 focus:border-cyan-400"
                  >
                    <option value="all">ALL LEVELS</option>
                    <option value="critical">CRITICAL</option>
                    <option value="high">HIGH</option>
                    <option value="low">LOW</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-500" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Incident Type</p>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="w-full appearance-none rounded border border-cyan-800/80 bg-[#05111d] px-3 py-2.5 text-xs font-mono text-cyan-100 outline-none transition-colors hover:border-cyan-500/80 focus:border-cyan-400"
                  >
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === 'all' ? 'ALL VECTORS' : option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-500" />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-[#0a0802]/60 p-4">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(245,158,11,0.05)_50%,transparent_75%)] bg-[length:10px_10px]" />
                <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">Replay Timeline</p>
                <div className="relative group mt-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={timelineCursor}
                    onChange={(event) => setTimelineCursor(Number(event.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-900 accent-amber-400 focus:outline-none"
                  />
                  <div className="absolute top-1/2 left-0 h-1.5 rounded-full bg-amber-400 pointer-events-none" style={{ width: `${timelineCursor}%` }} />
                </div>
                <p className="relative mt-2 text-xs font-mono font-bold text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]">RUNTIME: {timelineCursor}%</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-rows-[minmax(420px,1fr)_auto]">
            <GlassCard title="Global Severity Heatmap">
              <div className="relative h-[360px] w-full overflow-hidden rounded border border-cyan-600/30 bg-[#010811] shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] md:h-[430px] xl:h-[500px]">
                
                {/* Advanced Radar Glow */}
                <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_35%_40%,rgba(14,165,233,0.18),transparent_50%),radial-gradient(circle_at_70%_55%,rgba(245,158,11,0.15),transparent_40%),linear-gradient(to_bottom,rgba(1,8,17,0.95),rgba(3,11,22,0.98))]" />
                
                {/* Map Grid */}
                <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)] bg-[size:50px_50px]" />

                {/* World Map SVG */}
                <img
                  src="/world-lite.svg"
                  alt="Global threat map"
                  className="relative z-10 h-full w-full object-cover opacity-60 [filter:contrast(1.2)_brightness(0.9)_saturate(1.2)_drop-shadow(0_0_10px_rgba(56,189,248,0.3))]"
                  draggable={false}
                />

                <div className="absolute inset-0 z-20 overflow-hidden">
                  {/* Rotating Radar Sweep */}
                  <div className="absolute left-1/2 top-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2 origin-center animate-[spin_6s_linear_infinite] rounded-full pointer-events-none mix-blend-screen"
                       style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(34,211,238,0.15) 98%, rgba(255,255,255,0.4) 100%)' }} />
                  {/* Radar Crosshairs */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] -translate-x-1/2 bg-cyan-500/20 pointer-events-none" />
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] -translate-y-1/2 bg-cyan-500/20 pointer-events-none" />

                  {trajectoryPoints.map(({ attack, point }, index) => (
                    <span
                      key={`trajectory-${attack.id}-${index}`}
                      className="absolute block h-[3px] rounded-full"
                      style={{
                        ...buildTrajectoryStyle(point, TARGET_HUB, attack.severity, index),
                        boxShadow: `0 0 12px ${severityGlow(attack.severity)}`,
                      }}
                    />
                  ))}

                  {geoPoints.map(({ attack, point }, index) => {
                    const glow = severityGlow(attack.severity)
                    const style: CSSProperties = {
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      boxShadow: `0 0 20px ${glow}`,
                      animationDelay: `${(index % 10) * 0.1}s`,
                    }

                    return (
                      <button
                        key={`${attack.id}-${index}`}
                        type="button"
                        className="group absolute z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60"
                        style={{ ...style, backgroundColor: glow }}
                        onClick={() => actions.openReport(attack.id)}
                      >
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: glow, animation: 'soc-map-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}
                        />
                        <span className="pointer-events-none absolute left-1/2 bottom-full mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-cyan-500/50 bg-[#04111f]/95 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 backdrop-blur-sm group-hover:block transition-all animate-in zoom-in-75 duration-200">
                          <span className="text-slate-400">LOC:</span> {attack.sourceCountry.toUpperCase()}
                          <br/>
                          <span className="text-slate-400">VEC:</span> {normalizeIncidentType(attack.type).toUpperCase()}
                        </span>
                      </button>
                    )
                  })}

                  {/* Enhanced Target Hub */}
                  <div
                    className="group absolute z-30 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${TARGET_HUB.x}%`, top: `${TARGET_HUB.y}%` }}
                  >
                    <div className="relative flex h-6 w-6 items-center justify-center">
                       <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-40 animate-ping"></span>
                       <div className="h-3 w-3 rounded-full border border-cyan-100 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,1)]"></div>
                    </div>
                  </div>

                </div>
              </div>
            </GlassCard>

            <GlassCard title="Top Countries by Incident Volume">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_200px]">
                <div className="flex flex-col justify-center space-y-4">
                  {topCountries.length === 0 ? (
                    <div className="flex h-20 items-center justify-center rounded border border-dashed border-cyan-800/50">
                      <p className="text-xs font-mono text-cyan-600 animate-pulse">NO GEOSPATIAL DATA</p>
                    </div>
                  ) : (
                    topCountries.map((country, idx) => {
                      const pct = (country.count / countryTotal) * 100
                      return (
                        <div key={country.name} className="relative space-y-1.5 animate-in slide-in-from-left-4 fade-in" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-cyan-100 font-bold">{country.name.toUpperCase()}</span>
                            <span className="tabular-nums text-cyan-400">{formatPercent(pct)}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 shadow-inner">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-sky-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.1),transparent_60%)] pointer-events-none" />
                  <div
                    className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 border-cyan-900/40 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                    style={{ background: donutGradient }}
                  >
                    <div className="absolute inset-[26%] rounded-full border border-cyan-800/60 bg-[#030a11] shadow-inner flex items-center justify-center">
                      <span className="text-[10px] font-mono font-bold text-cyan-500/60">VOL</span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-rows-[auto_auto_1fr]">
            <GlassCard title="Operational KPIs">
              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="MTTR" value={mttr} tone="text-cyan-300" suffix="m" />
                <MetricTile label="MTTD" value={mttd} tone="text-amber-300" suffix="m" />
                <MetricTile label="Active IPs" value={activeIps} tone="text-sky-300" />
                <MetricTile label="Queue" value={snapshot.criticalQueue.length} tone="text-rose-400" />
              </div>
            </GlassCard>

            <GlassCard title="Incident Vectors">
              <div className="grid grid-cols-[100px_1fr] items-center gap-5">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-800/40 shadow-[0_0_20px_rgba(0,0,0,0.5)]" style={{ background: donutGradient }}>
                  <div className="absolute inset-[30%] rounded-full bg-[#030a11] shadow-inner" />
                </div>
                <ul className="space-y-2">
                  {incidentTypeBreakdown.length === 0 ? (
                    <li className="text-xs font-mono text-cyan-600 animate-pulse">AWAITING TELEMETRY</li>
                  ) : (
                    incidentTypeBreakdown.map((item, idx) => {
                      const pct = (item.value / Math.max(1, totalIncidents)) * 100
                      return (
                        <li key={item.label} className="group flex items-center justify-between text-[11px] font-mono animate-in slide-in-from-right-4 fade-in" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}>
                          <span className="flex items-center gap-2 text-cyan-100">
                            <i className="h-2 w-2 rounded-sm shadow-[0_0_8px_currentColor]" style={{ backgroundColor: item.color, color: item.color }} />
                            {item.label.toUpperCase()}
                          </span>
                          <span className="tabular-nums text-cyan-400 group-hover:text-cyan-300 transition-colors">{formatPercent(pct)}</span>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            </GlassCard>

            <GlassCard title="Live Incident Feed">
              <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-2 overflow-x-hidden custom-scrollbar">
                {liveFeed.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center rounded border border-dashed border-cyan-800/50 bg-cyan-950/10">
                    <span className="w-4 h-4 rounded-full border-[2px] border-cyan-500/20 border-t-cyan-400 animate-spin mb-3"></span>
                    <p className="animate-pulse text-xs font-mono text-cyan-500">SCANNING FOR ANOMALIES...</p>
                  </div>
                ) : (
                  liveFeed.map((attack, index) => (
                    <button
                      key={attack.id}
                      type="button"
                      className={`group relative grid w-full grid-cols-[65px_1fr_auto] items-center gap-3 overflow-hidden rounded border border-cyan-900/40 bg-[#06101c]/60 px-3 py-2.5 text-left transition-all hover:border-cyan-400/60 hover:bg-cyan-900/30 hover:pl-4 animate-in slide-in-from-right-4 fade-in duration-300 ${
                        attack.severity === 'critical' ? 'shadow-[0_0_0_1px_rgba(251,113,133,0.5)] border-rose-500/50 bg-rose-950/10' : ''
                      }`}
                      style={{ animationDelay: `${(index % 15) * 50}ms`, animationFillMode: 'both' }}
                      onClick={() => actions.openReport(attack.id)}
                    >
                      {/* Tech decorative vertical line */}
                      <span className="absolute left-0 top-0 h-full w-[2px] bg-cyan-600/50 group-hover:bg-cyan-400 transition-colors" />

                      <span className="text-[10px] font-mono tabular-nums text-cyan-500/80 group-hover:text-cyan-300">{formatClock(attack.createdAt)}</span>
                      <span className="flex items-center gap-2 truncate text-[11px] font-bold tracking-wide text-slate-200 group-hover:text-white">
                        {attack.severity === 'critical' && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(251,113,133,1)] animate-pulse" />}
                        {normalizeIncidentType(attack.type).toUpperCase()}
                      </span>
                      <span className="truncate text-[10px] font-mono text-slate-500 group-hover:text-cyan-200">{attack.sourceCountry.toUpperCase()}</span>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </section>

        <GlassCard title="Dynamic Frequency Analysis">
          <div className="space-y-4">
            <div className="flex h-28 items-end gap-1.5 px-2">
              {timelineSeries.map((value, index) => {
                const active = index <= timelineThreshold
                const isHigh = value > 72
                return (
                  <div
                    key={`timeline-${index}`}
                    className="group relative flex-1 h-full flex items-end justify-center"
                  >
                    <span
                      className={`w-full max-w-[40px] rounded-t-sm transition-all duration-500 ease-out ${
                        isHigh ? 'bg-gradient-to-t from-amber-600 to-amber-400' : 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                      }`}
                      style={{
                        height: `${value}%`,
                        opacity: active ? (isHigh ? 0.95 : 0.85) : 0.2,
                        boxShadow: active
                          ? isHigh
                            ? '0 0 16px rgba(245,158,11,0.5)'
                            : '0 0 12px rgba(34,211,238,0.4)'
                          : 'none',
                        filter: active ? 'drop-shadow(0 -2px 4px rgba(255,255,255,0.2))' : 'none'
                      }}
                    />
                    {/* Hover tooltip for bars */}
                    <div className="absolute bottom-full mb-2 hidden scale-95 opacity-0 transition-all group-hover:block group-hover:scale-100 group-hover:opacity-100">
                       <span className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-[10px] font-mono text-white tabular-nums">{value}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-sm bg-cyan-500"></span>T-{timeWindowHours}H</span>
              <span className="text-amber-500/80">REPLAY {timelineCursor}%</span>
              <span className="flex items-center gap-2">REAL-TIME <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span></span>
            </div>
          </div>
        </GlassCard>
      </div>

      <CriticalAlertPanel
        queue={snapshot.criticalQueue}
        open={snapshot.panelOpen}
        onReport={(attack) => actions.openReport(attack.id)}
        onDismiss={actions.dismissIncident}
        onClose={actions.closePanel}
      />

      <AttackReportModal attack={snapshot.reportTarget} open={snapshot.reportModalOpen} onClose={actions.closeReport} />

      <style jsx global>{`
        @keyframes soc-map-ping {
          0% {
            transform: scale(0.5);
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(inherit, 0.7);
          }
          70% {
            transform: scale(3.5);
            opacity: 0;
            box-shadow: 0 0 0 10px rgba(inherit, 0);
          }
          100% {
            transform: scale(4);
            opacity: 0;
            box-shadow: 0 0 0 0 rgba(inherit, 0);
          }
        }

        @keyframes soc-trajectory {
          0% {
            opacity: 0;
            filter: blur(2px);
          }
          20% {
            opacity: 1;
            filter: blur(0);
          }
          80% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            filter: blur(2px);
          }
        }

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(4, 13, 23, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.6);
        }
      `}</style>
    </div>
  )
}
