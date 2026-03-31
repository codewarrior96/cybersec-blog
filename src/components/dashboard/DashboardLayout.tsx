'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AttackEvent } from '@/lib/dashboard-types'
import AttackReportModal from '@/components/dashboard/AttackReportModal'
import CriticalAlertPanel from '@/components/dashboard/CriticalAlertPanel'
import CriticalOverlayFx from '@/components/dashboard/CriticalOverlayFx'
import { useSocRuntime } from '@/lib/soc-runtime/use-soc-runtime'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'

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

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
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
      className={`rounded-xl border border-cyan-400/20 bg-[linear-gradient(165deg,rgba(6,20,35,0.86),rgba(4,13,25,0.78))] shadow-[0_0_0_1px_rgba(56,189,248,0.08),0_20px_45px_rgba(0,0,0,0.45)] backdrop-blur-md ${className}`}
    >
      <header className="flex items-center justify-between border-b border-cyan-500/15 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/90">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function MetricTile({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <article className="rounded-lg border border-cyan-500/20 bg-black/25 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
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
      return 'conic-gradient(#1e293b 0% 100%)'
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
      .slice(0, 30)
      .map((attack) => {
        const point = resolveCountryCoords(attack.sourceCountry)
        if (!point) return null
        return { attack, point }
      })
      .filter((value): value is { attack: AttackEvent; point: { x: number; y: number } } => value !== null)
  }, [filteredAttacks])

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

  const liveFeed = filteredAttacks.slice(0, 8)
  const countryTotal = Math.max(1, countryBreakdown.reduce((sum, item) => sum + item.count, 0))

  const healthScore = Math.max(
    12,
    Math.min(99, Math.round(96 - criticalIncidents * 3.6 - (snapshot.metrics?.attack.liveDensity ?? 0) * 4.1 - ongoingIncidents * 0.4)),
  )

  if (!mounted) return null

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#040d17] text-slate-100">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_12%_18%,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_78%_24%,rgba(245,158,11,0.12),transparent_30%),linear-gradient(180deg,#02070f_0%,#040d17_48%,#030b15_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:linear-gradient(to_right,rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

      {snapshot.overlayActive ? <CriticalOverlayFx cycle={snapshot.overlayCycle} /> : null}

      <div className="relative z-10 mx-auto flex w-full max-w-[1700px] flex-col gap-3 p-3 md:p-4">
        <GlassCard
          title="Sentinel Prime SOC Matrix"
          right={
            <div className="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                className="rounded border border-cyan-400/40 px-2 py-1 text-cyan-200 hover:bg-cyan-400/10"
                onClick={() => void actions.refreshMetrics()}
              >
                sync metrics
              </button>
              <button
                type="button"
                className="rounded border border-amber-400/40 px-2 py-1 text-amber-200 hover:bg-amber-400/10"
                onClick={() => void actions.refreshSummary()}
              >
                sync incidents
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <MetricTile label="Health Score" value={`${healthScore}/100`} tone="text-cyan-200" />
            <MetricTile label="Total Incidents" value={totalIncidents} tone="text-slate-100" />
            <MetricTile label="Resolver" value={resolvedIncidents} tone="text-emerald-200" />
            <MetricTile label="Ongoing" value={ongoingIncidents} tone="text-amber-200" />
            <MetricTile label="Critical" value={criticalIncidents} tone="text-rose-200" />
            <MetricTile label="Threats / Min" value={attacksPerMinute} tone="text-sky-200" />
          </div>
        </GlassCard>

        <section className="grid min-h-[690px] grid-cols-1 gap-3 xl:grid-cols-[240px_minmax(0,1fr)_330px]">
          <GlassCard title="Filter Control" className="min-h-[690px]">
            <div className="space-y-5 text-sm">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Date Range (hours)</p>
                <input
                  type="range"
                  min={1}
                  max={72}
                  value={timeWindowHours}
                  onChange={(event) => setTimeWindowHours(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
                />
                <p className="mt-2 text-xs text-cyan-200">Last {timeWindowHours} hours</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Region</p>
                <select
                  value={regionFilter}
                  onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
                  className="w-full rounded-md border border-cyan-600/25 bg-[#071827] px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400/70"
                >
                  <option value="all">All Regions</option>
                  <option value="americas">Americas</option>
                  <option value="emea">EMEA</option>
                  <option value="apac">APAC</option>
                </select>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Severity</p>
                <select
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
                  className="w-full rounded-md border border-cyan-600/25 bg-[#071827] px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400/70"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">Incident Type</p>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="w-full rounded-md border border-cyan-600/25 bg-[#071827] px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400/70"
                >
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All Types' : option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-cyan-500/20 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Live Cursor</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={timelineCursor}
                  onChange={(event) => setTimelineCursor(Number(event.target.value))}
                  className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-amber-400"
                />
                <p className="mt-2 text-xs text-amber-200">Replay {timelineCursor}%</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid min-h-[690px] grid-cols-1 gap-3 xl:grid-rows-[1fr_220px]">
            <GlassCard title="Severity Heatmap">
              <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-[#020a14]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(56,189,248,0.14),transparent_42%),radial-gradient(circle_at_72%_44%,rgba(245,158,11,0.18),transparent_34%),linear-gradient(to_bottom,rgba(7,18,31,0.95),rgba(3,11,22,0.96))]" />
                <img
                  src="/world.svg"
                  alt="Global threat map"
                  className="relative z-10 h-[430px] w-full object-cover opacity-30 [filter:contrast(1.1)_brightness(0.7)_hue-rotate(150deg)_saturate(1.2)]"
                  draggable={false}
                />

                <div className="absolute inset-0 z-20">
                  {geoPoints.map(({ attack, point }, index) => {
                    const glow = severityGlow(attack.severity)
                    const style: CSSProperties = {
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      boxShadow: `0 0 16px ${glow}`,
                      animationDelay: `${(index % 10) * 0.15}s`,
                    }

                    return (
                      <button
                        key={`${attack.id}-${index}`}
                        type="button"
                        className="group absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
                        style={{ ...style, backgroundColor: glow }}
                        onClick={() => actions.openReport(attack.id)}
                      >
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: glow, animation: 'soc-map-ping 2.6s ease-out infinite' }}
                        />
                        <span className="pointer-events-none absolute left-1/2 top-[-28px] hidden -translate-x-1/2 whitespace-nowrap rounded border border-slate-500/35 bg-[#04111f]/95 px-2 py-1 text-[10px] text-slate-100 group-hover:block">
                          {attack.sourceCountry} | {normalizeIncidentType(attack.type)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </GlassCard>

            <GlassCard title="Top Countries by Incident Count">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_180px]">
                <div className="space-y-3">
                  {topCountries.length === 0 ? (
                    <p className="text-sm text-slate-400">No country incidents found in selected filters.</p>
                  ) : (
                    topCountries.map((country) => {
                      const pct = (country.count / countryTotal) * 100
                      return (
                        <div key={country.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-200">{country.name}</span>
                            <span className="tabular-nums text-slate-400">{formatPercent(pct)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800/80">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#0ea5e9)] shadow-[0_0_12px_rgba(56,189,248,0.45)]"
                              style={{ width: `${Math.max(8, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <div
                    className="relative h-36 w-36 rounded-full border border-cyan-400/20"
                    style={{ background: donutGradient }}
                  >
                    <div className="absolute inset-[24%] rounded-full border border-cyan-400/20 bg-[#04101f]" />
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="grid min-h-[690px] grid-cols-1 gap-3 xl:grid-rows-[220px_190px_1fr]">
            <GlassCard title="Top Countries Snapshot">
              <div className="space-y-2">
                {topCountries.length === 0 ? (
                  <p className="text-sm text-slate-400">No regional data.</p>
                ) : (
                  topCountries.map((country) => {
                    const pct = (country.count / countryTotal) * 100
                    return (
                      <div key={`right-${country.name}`} className="flex items-center gap-2">
                        <span className="w-24 truncate text-xs text-slate-300">{country.name}</span>
                        <div className="h-2 flex-1 rounded-full bg-slate-800/75">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#38bdf8)]"
                            style={{ width: `${Math.max(10, pct)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>

            <GlassCard title="Incident Types">
              <div className="grid grid-cols-[96px_1fr] items-center gap-3">
                <div className="relative h-24 w-24 rounded-full border border-cyan-400/20" style={{ background: donutGradient }}>
                  <div className="absolute inset-[28%] rounded-full bg-[#061320]" />
                </div>
                <ul className="space-y-1">
                  {incidentTypeBreakdown.length === 0 ? (
                    <li className="text-xs text-slate-400">No incident distribution.</li>
                  ) : (
                    incidentTypeBreakdown.map((item) => {
                      const pct = (item.value / Math.max(1, totalIncidents)) * 100
                      return (
                        <li key={item.label} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2 text-slate-200">
                            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}
                          </span>
                          <span className="tabular-nums text-slate-400">{formatPercent(pct)}</span>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            </GlassCard>

            <GlassCard title="Live Incident Feed">
              <div className="space-y-2">
                {liveFeed.length === 0 ? (
                  <p className="text-sm text-slate-400">No live incidents for current filters.</p>
                ) : (
                  liveFeed.map((attack) => (
                    <button
                      key={attack.id}
                      type="button"
                      className="grid w-full grid-cols-[46px_1fr_auto] items-center gap-2 rounded-md border border-slate-700/70 bg-black/20 px-2 py-1.5 text-left transition hover:border-cyan-400/45 hover:bg-cyan-500/10"
                      onClick={() => actions.openReport(attack.id)}
                    >
                      <span className="text-[11px] tabular-nums text-slate-400">{formatClock(attack.createdAt)}</span>
                      <span className="truncate text-xs text-slate-100">{normalizeIncidentType(attack.type)}</span>
                      <span className="text-[11px] text-slate-300">{attack.sourceCountry}</span>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </section>

        <GlassCard title="Dynamic Frequency">
          <div className="space-y-3">
            <div className="flex h-24 items-end gap-1">
              {timelineSeries.map((value, index) => {
                const active = index <= timelineThreshold
                return (
                  <span
                    key={`timeline-${index}`}
                    className={`w-full rounded-t-sm ${value > 72 ? 'bg-amber-400/85' : 'bg-cyan-400/80'}`}
                    style={{
                      height: `${value}%`,
                      opacity: active ? 1 : 0.22,
                      boxShadow: active
                        ? value > 72
                          ? '0 0 12px rgba(245,158,11,0.45)'
                          : '0 0 12px rgba(34,211,238,0.45)'
                        : 'none',
                    }}
                  />
                )
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <span>T-{timeWindowHours}h</span>
              <span>Replay {timelineCursor}%</span>
              <span>Now</span>
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
            transform: scale(0.6);
            opacity: 0.95;
          }
          75% {
            transform: scale(2.8);
            opacity: 0;
          }
          100% {
            transform: scale(3.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
