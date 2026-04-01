'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AttackEvent } from '@/lib/dashboard-types'
import AttackReportModal from '@/components/dashboard/AttackReportModal'
import CriticalAlertPanel from '@/components/dashboard/CriticalAlertPanel'
import CriticalOverlayFx from '@/components/dashboard/CriticalOverlayFx'
import { useSocRuntime } from '@/lib/soc-runtime/use-soc-runtime'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'
import CountUp from '@/components/CountUp'
import MatrixRain from '@/components/MatrixRain'

// ─── Coğrafi koordinatlar (% bazlı, SVG harita üstü) ─────────────────────────

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
  netherlands: { x: 48, y: 29 },
  poland: { x: 51, y: 29 },
  sweden: { x: 50, y: 22 },
  israel: { x: 55, y: 41 },
  'saudi arabia': { x: 58, y: 45 },
  iran: { x: 60, y: 40 },
}

const TARGET_HUB = { x: 55, y: 46 }

// ─── Yardımcı işlevler ────────────────────────────────────────────────────────

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function severityGlow(severity: AttackEvent['severity']): string {
  if (severity === 'critical') return '#fb7185'
  if (severity === 'high') return '#f59e0b'
  return '#22d3ee'
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
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
    background: `linear-gradient(90deg,${hexToRgba(color, 0.15)} 0%,${hexToRgba(color, 0.9)} 40%,transparent 100%)`,
    boxShadow: `0 0 8px ${hexToRgba(color, 0.55)}`,
    animation: `soc-trajectory 3s ease-in-out ${index * 0.15}s infinite`,
  }
}

function resolveCountryCoords(country: string): { x: number; y: number } | null {
  const key = country.toLowerCase().trim()
  if (COUNTRY_COORDS[key]) return COUNTRY_COORDS[key]
  const found = Object.entries(COUNTRY_COORDS).find(
    ([name]) => key.includes(name) || name.includes(key),
  )
  return found ? found[1] : null
}

function normalizeIncidentType(rawType: string): string {
  const t = rawType.toLowerCase()
  if (t.includes('ddos') || t.includes('dos') || t.includes('flood')) return 'DDoS'
  if (t.includes('phishing') || t.includes('spear')) return 'Phishing'
  if (t.includes('ransom')) return 'Ransomware'
  if (t.includes('breach') || t.includes('leak') || t.includes('exfil')) return 'Data Breach'
  if (t.includes('scan') || t.includes('recon') || t.includes('port')) return 'Recon'
  if (t.includes('sql') || t.includes('rce') || t.includes('xss')) return 'Exploit'
  return 'Other'
}

// ─── Alert öncelik renkleri ───────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  P1: {
    border: 'border-rose-500/50',
    bg: 'bg-rose-950/40',
    badge: 'border-rose-500/70 text-rose-300 bg-rose-950/60',
    text: 'text-rose-200',
  },
  P2: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/30',
    badge: 'border-amber-500/60 text-amber-300 bg-amber-950/60',
    text: 'text-amber-100',
  },
  P3: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-950/20',
    badge: 'border-yellow-500/50 text-yellow-300 bg-yellow-950/40',
    text: 'text-yellow-100',
  },
  P4: {
    border: 'border-slate-700/40',
    bg: 'bg-slate-900/30',
    badge: 'border-slate-600/50 text-slate-400 bg-slate-800/50',
    text: 'text-slate-300',
  },
}

// ─── GlassCard ────────────────────────────────────────────────────────────────

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
      className={`relative rounded-none border-[1.5px] border-cyan-500/25 bg-[#030a11]/85 backdrop-blur-md shadow-[inset_0_0_20px_rgba(34,211,238,0.04),0_0_20px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* Sci-fi köşe braketleri */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/80 -translate-x-px -translate-y-px" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/80 translate-x-px -translate-y-px" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400/80 -translate-x-px translate-y-px" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/80 translate-x-px translate-y-px" />

      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(transparent_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px]" />

      <header className="relative flex items-center justify-between border-b border-cyan-500/15 bg-gradient-to-r from-cyan-950/40 to-transparent px-4 py-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100 flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          {title}
        </h2>
        {right}
      </header>

      <div className="relative p-4 z-10">{children}</div>
    </section>
  )
}

// ─── MetricTile ───────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  tone,
  suffix = '',
}: {
  label: string
  value: number
  tone: string
  suffix?: string
}) {
  return (
    <article className="rounded border border-cyan-500/15 bg-[#06101a]/70 px-3 py-3 hover:border-cyan-400/30 hover:bg-cyan-950/30 transition-colors">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums tracking-wide drop-shadow-[0_0_6px_currentColor] ${tone}`}>
        <CountUp to={value} suffix={suffix} />
      </p>
    </article>
  )
}

// ─── Alert tipi ───────────────────────────────────────────────────────────────

interface AlertItem {
  id: number
  title: string
  priority: string
  status: string
  createdAt: string
  sourceIp: string | null
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const { mounted, snapshot, actions } = useSocRuntime({
    overlayDurationMs: CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  })

  // Alert Management state
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)

  // Stabil attacks dizisi — yalnızca snapshot.attacks değişince yeni referans
  const attacks = useMemo(
    () => [...snapshot.attacks].reverse(),
    [snapshot.attacks],
  )

  // Harita noktaları
  const geoPoints = useMemo(() => {
    return attacks
      .slice(0, 30)
      .map((attack) => {
        const point = resolveCountryCoords(attack.sourceCountry)
        if (!point) return null
        return { attack, point }
      })
      .filter(
        (v): v is { attack: AttackEvent; point: { x: number; y: number } } => v !== null,
      )
  }, [attacks])

  const trajectoryPoints = useMemo(() => geoPoints.slice(0, 18), [geoPoints])

  // KPI metrikleri
  const criticalCount = useMemo(
    () => attacks.filter((a) => a.severity === 'critical').length,
    [attacks],
  )

  const resolvedCount = snapshot.metrics?.triageBoard.resolved ?? 0
  const ongoingCount = snapshot.metrics?.triageBoard.inProgress ?? snapshot.alertCount
  const attacksPerMin = snapshot.metrics?.attack.attacksPerMinute ?? 0

  const healthScore = useMemo(
    () =>
      Math.max(
        12,
        Math.min(
          99,
          Math.round(
            96 -
              criticalCount * 3.6 -
              (snapshot.metrics?.attack.liveDensity ?? 0) * 4.1 -
              ongoingCount * 0.4,
          ),
        ),
      ),
    [criticalCount, snapshot.metrics?.attack.liveDensity, ongoingCount],
  )

  // Alert fetch — yalnızca alertCount değişince
  const fetchAlerts = useCallback(async () => {
    try {
      setAlertsLoading(true)
      const res = await fetch('/api/alerts?limit=10')
      if (!res.ok) return
      const data: { alerts?: AlertItem[] } = await res.json()
      if (Array.isArray(data.alerts)) setAlerts(data.alerts)
    } catch {
      // sessizce geç
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts, snapshot.alertCount])

  if (!mounted) return null

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#02060c] text-slate-100 font-mono">

      {/* ── Arka plan katmanları ──────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 opacity-10 mix-blend-screen pointer-events-none">
        <MatrixRain />
      </div>
      <div className="pointer-events-none absolute inset-0 z-0 [background:radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_82%_28%,rgba(0,255,136,0.07),transparent_35%),linear-gradient(180deg,transparent_0%,rgba(2,6,12,0.7)_80%,#02060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.18] [background:linear-gradient(to_right,rgba(56,189,248,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* ── Kritik overlay ────────────────────────────────────────────────── */}
      {snapshot.overlayActive ? <CriticalOverlayFx cycle={snapshot.overlayCycle} /> : null}

      {/* ── Ana içerik ───────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-[1800px] flex flex-col gap-4 p-3 md:p-5">

        {/* ── ROW 1: KPI Şeridi ─────────────────────────────────────────── */}
        <GlassCard
          title="Sentinel Prime SOC Matrix"
          right={
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => void actions.refreshMetrics()}
                className="rounded border border-cyan-500/25 bg-cyan-950/20 px-3 py-1 text-cyan-300 hover:border-cyan-400/60 hover:bg-cyan-400/15 transition-colors"
              >
                SYNC
              </button>
              <span className="flex items-center gap-1.5 text-emerald-400 tracking-widest">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LIVE
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricTile label="Health Score" value={healthScore} suffix="/100" tone="text-cyan-300" />
            <MetricTile label="Total Incidents" value={attacks.length} tone="text-slate-100" />
            <MetricTile label="Resolved" value={resolvedCount} tone="text-emerald-300" />
            <MetricTile label="Ongoing" value={ongoingCount} tone="text-amber-300" />
            <MetricTile label="Critical" value={criticalCount} tone="text-rose-400" />
            <MetricTile label="Threats / Min" value={attacksPerMin} tone="text-sky-300" />
          </div>
        </GlassCard>

        {/* ── ROW 2: Harita (sol) + Sidebar (sağ) ──────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4">

          {/* ── DÜNYA HARİTASI ──────────────────────────────────────────── */}
          <GlassCard title="Global Severity Heatmap">
            <div className="relative h-[360px] md:h-[460px] xl:h-[520px] w-full overflow-hidden rounded border border-cyan-600/20 bg-[#010811] shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">

              {/* Arka plan glow */}
              <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_35%_45%,rgba(14,165,233,0.14),transparent_52%),radial-gradient(circle_at_72%_58%,rgba(245,158,11,0.10),transparent_40%)]" />
              {/* Grid çizgileri */}
              <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(56,189,248,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.07)_1px,transparent_1px)] bg-[size:50px_50px]" />

              {/* SVG Dünya haritası */}
              <img
                src="/world-lite.svg"
                alt="Global threat map"
                className="relative z-10 h-full w-full object-cover opacity-55 [filter:contrast(1.25)_brightness(0.88)_saturate(1.15)_drop-shadow(0_0_8px_rgba(56,189,248,0.25))]"
                draggable={false}
              />

              {/* Radar + saldırı katmanı */}
              <div className="absolute inset-0 z-20 overflow-hidden">

                {/* Dönen radar süpürgesi */}
                <div
                  className="absolute left-1/2 top-1/2 aspect-square w-[145%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none mix-blend-screen animate-[spin_8s_linear_infinite]"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 72%, rgba(34,211,238,0.10) 96%, rgba(255,255,255,0.30) 100%)',
                  }}
                />

                {/* Artı çizgileri */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-cyan-500/10 pointer-events-none" />
                <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-cyan-500/10 pointer-events-none" />

                {/* Trajectory çizgileri (CSS animasyonu) */}
                {trajectoryPoints.map(({ attack, point }, i) => (
                  <span
                    key={`traj-${attack.id}`}
                    className="absolute block h-[2px] rounded-full"
                    style={buildTrajectoryStyle(point, TARGET_HUB, attack.severity, i)}
                  />
                ))}

                {/* Saldırı noktaları */}
                {geoPoints.map(({ attack, point }, i) => {
                  const glow = severityGlow(attack.severity)
                  return (
                    <button
                      key={`dot-${attack.id}`}
                      type="button"
                      className="group absolute z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
                      style={{
                        left: `${point.x}%`,
                        top: `${point.y}%`,
                        backgroundColor: glow,
                        boxShadow: `0 0 14px ${glow}`,
                        animationDelay: `${(i % 10) * 0.12}s`,
                      }}
                      onClick={() => actions.openReport(attack.id)}
                      title={`${attack.sourceCountry} — ${attack.type}`}
                    >
                      <span
                        className="absolute inset-0 rounded-full"
                        style={{
                          backgroundColor: glow,
                          animation: 'soc-map-ping 2.2s cubic-bezier(0,0,0.2,1) infinite',
                        }}
                      />
                      {/* Tooltip */}
                      <span className="pointer-events-none absolute left-1/2 bottom-full mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-cyan-500/40 bg-[#04111f]/95 px-2 py-1 text-[10px] text-cyan-100 backdrop-blur-sm group-hover:block">
                        <span className="text-slate-400">LOC:</span>{' '}
                        {attack.sourceCountry.toUpperCase()}
                        <br />
                        <span className="text-slate-400">VEC:</span>{' '}
                        {normalizeIncidentType(attack.type).toUpperCase()}
                      </span>
                    </button>
                  )
                })}

                {/* Hedef merkez noktası */}
                <div
                  className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${TARGET_HUB.x}%`, top: `${TARGET_HUB.y}%` }}
                >
                  <div className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-25 animate-ping" />
                    <div className="h-2.5 w-2.5 rounded-full border border-cyan-100 bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,1)]" />
                  </div>
                </div>

              </div>
            </div>
          </GlassCard>

          {/* ── SAĞ SİDEBAR ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* Alert Yönetimi */}
            <GlassCard
              title="Alert Yönetimi"
              right={
                <span className="text-[10px] font-mono text-cyan-500/50 tabular-nums">
                  {alerts.length} KAYIT
                </span>
              }
            >
              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {alertsLoading ? (
                  <div className="flex h-20 items-center justify-center">
                    <span className="text-xs font-mono text-cyan-600 animate-pulse">
                      YÜKLENIYOR...
                    </span>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="flex h-20 items-center justify-center">
                    <span className="text-xs font-mono text-slate-600">
                      ALERT BULUNAMADI
                    </span>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const p = (alert.priority ?? 'P4') as keyof typeof PRIORITY_STYLE
                    const style = PRIORITY_STYLE[p] ?? PRIORITY_STYLE.P4
                    return (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-2.5 rounded border ${style.border} ${style.bg} px-3 py-2`}
                      >
                        <span
                          className={`shrink-0 mt-0.5 text-[9px] font-bold rounded px-1.5 py-0.5 border ${style.badge}`}
                        >
                          {p}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[11px] font-bold ${style.text}`}>
                            {alert.title}
                          </p>
                          <p className="text-[9px] font-mono text-slate-600 mt-0.5">
                            {new Date(alert.createdAt).toLocaleTimeString('tr-TR')}
                            {alert.sourceIp ? ` · ${alert.sourceIp}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>

            {/* Canlı Olay Feed'i */}
            <GlassCard
              title="Canlı Olay Feed'i"
              right={
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 tracking-widest">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  CANLI
                </span>
              }
            >
              <div className="space-y-1 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                {attacks.length === 0 ? (
                  <div className="flex h-28 flex-col items-center justify-center rounded border border-dashed border-cyan-800/40 bg-cyan-950/10">
                    <span className="w-4 h-4 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-2.5" />
                    <span className="text-xs font-mono text-cyan-600 animate-pulse">
                      ANOMALİ TARAMASI...
                    </span>
                  </div>
                ) : (
                  attacks.slice(0, 30).map((attack) => (
                    <button
                      key={attack.id}
                      type="button"
                      onClick={() => actions.openReport(attack.id)}
                      className={`group w-full grid grid-cols-[58px_1fr_auto] items-center gap-2 rounded border px-3 py-2 text-left hover:bg-cyan-900/20 transition-colors ${
                        attack.severity === 'critical'
                          ? 'border-rose-500/40 bg-rose-950/10'
                          : 'border-cyan-900/25 bg-[#06101c]/40'
                      }`}
                    >
                      {/* Sol dikey çizgi */}
                      <span
                        className={`absolute left-0 top-0 hidden group-hover:block h-full w-0.5 ${
                          attack.severity === 'critical'
                            ? 'bg-rose-500/70'
                            : 'bg-cyan-500/50'
                        }`}
                      />

                      <span className="text-[10px] font-mono tabular-nums text-cyan-600/80">
                        {formatClock(attack.createdAt)}
                      </span>

                      <span className="truncate text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                        {attack.severity === 'critical' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        )}
                        {normalizeIncidentType(attack.type)}
                      </span>

                      <span className="text-[10px] font-mono text-slate-500 truncate">
                        {attack.sourceCountry.toUpperCase()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>

          </div>
        </div>
      </div>

      {/* ── Modaller ─────────────────────────────────────────────────────── */}
      <CriticalAlertPanel
        queue={snapshot.criticalQueue}
        open={snapshot.panelOpen}
        onReport={(attack) => actions.openReport(attack.id)}
        onDismiss={actions.dismissIncident}
        onClose={actions.closePanel}
      />
      <AttackReportModal
        attack={snapshot.reportTarget}
        open={snapshot.reportModalOpen}
        onClose={actions.closeReport}
      />
    </div>
  )
}
