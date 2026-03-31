'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AttackEvent } from '@/lib/dashboard-types'
import AttackReportModal from '@/components/dashboard/AttackReportModal'
import CriticalAlertPanel from '@/components/dashboard/CriticalAlertPanel'
import CriticalOverlayFx from '@/components/dashboard/CriticalOverlayFx'
import { useSocRuntime } from '@/lib/soc-runtime/use-soc-runtime'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function seeded(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function severityColor(severity: AttackEvent['severity']) {
  if (severity === 'critical') return 'var(--threat-red)'
  if (severity === 'high') return 'var(--warning-orange)'
  return 'var(--accent-cyan)'
}

function cardTone(severity: AttackEvent['severity']) {
  if (severity === 'critical') return 'border-red-400/45 bg-red-500/10 text-red-200'
  if (severity === 'high') return 'border-orange-400/45 bg-orange-500/10 text-orange-200'
  return 'border-cyan-400/45 bg-cyan-500/10 text-cyan-200'
}

function WarCard({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-emerald-400/18 bg-[rgba(7,14,18,0.62)] backdrop-blur-xl shadow-[0_0_0_1px_rgba(0,255,136,0.08),0_22px_48px_rgba(0,0,0,0.45)] ${className}`}
    >
      <header className="flex items-start justify-between border-b border-emerald-400/14 px-4 py-3">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/90">{title}</h2>
          {subtitle ? <p className="mt-1 text-[10px] text-slate-400">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function HeaderMiniStat({
  label,
  value,
  colorClass,
}: {
  label: string
  value: string | number
  colorClass: string
}) {
  return (
    <div className="rounded-xl border border-slate-500/30 bg-black/25 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black tabular-nums ${colorClass}`}>{value}</p>
    </div>
  )
}

function HealthGauge({ score }: { score: number }) {
  const bounded = Math.max(1, Math.min(100, score))
  const color =
    bounded >= 80
      ? 'var(--accent-green)'
      : bounded >= 60
        ? 'var(--warning-orange)'
        : 'var(--threat-red)'

  return (
    <div className="flex items-center gap-4 rounded-xl border border-emerald-400/25 bg-black/25 px-3 py-2">
      <div
        className="relative flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color} 0 ${bounded}%, rgba(148,163,184,0.18) ${bounded}% 100%)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/20 bg-[#04110f]">
          <span className="text-xs font-bold text-emerald-100">{bounded}</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Cyber Security Health Score</p>
        <p className="text-xl font-black tabular-nums text-emerald-100">{bounded}/100</p>
      </div>
    </div>
  )
}

function buildTrajectoryStyle(attack: AttackEvent, index: number): CSSProperties {
  const angle = -75 + seeded(attack.id + index * 3.3) * 150
  const length = 65 + seeded(attack.id * 1.7 + index) * 130
  const top = 15 + seeded(attack.id * 2.1 + index) * 70
  const left = 12 + seeded(attack.id * 2.7 + index) * 72
  const duration = 2.6 + seeded(attack.id * 5.7 + index) * 2.2
  const delay = seeded(attack.id * 7.3 + index) * 2.4
  const color = severityColor(attack.severity)

  return {
    top: `${top}%`,
    left: `${left}%`,
    width: `${Math.round(length)}px`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 50%',
    background: `linear-gradient(90deg, ${color} 0%, rgba(226,232,240,0.95) 34%, transparent 100%)`,
    boxShadow: `0 0 12px ${color}`,
    animation: `sentinel-comet ${duration}s ease-in-out ${delay}s infinite`,
  }
}

function HoloGlobe({ attacks }: { attacks: AttackEvent[] }) {
  const trajectories = attacks.slice(0, 18)
  const focus = attacks[0]

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[620px]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(56,189,248,0.35),rgba(4,18,26,0.92)_55%,rgba(1,4,7,0.98)_100%)] shadow-[0_0_80px_rgba(34,211,238,0.16),inset_0_0_80px_rgba(34,211,238,0.08)]" />
      <div className="absolute inset-0 rounded-full border border-cyan-300/25 [animation:sentinel-spin_30s_linear_infinite]" />
      <div className="absolute inset-[7%] rounded-full border border-cyan-300/15 [animation:sentinel-scan_5.5s_ease-in-out_infinite]" />
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(20,184,166,0.18),transparent_72%)]" />
      <div className="absolute inset-[8%] rounded-full bg-[conic-gradient(from_30deg,rgba(34,211,238,0.28),transparent_22%,rgba(16,185,129,0.24)_36%,transparent_58%,rgba(34,211,238,0.20)_73%,transparent_100%)] opacity-60 [animation:sentinel-spin_42s_linear_infinite_reverse]" />
      <div className="absolute inset-[14%] rounded-full [background:repeating-radial-gradient(circle_at_center,rgba(148,163,184,0.08)_0px,rgba(148,163,184,0.08)_1px,transparent_2px,transparent_11px)]" />

      {trajectories.map((attack, index) => (
        <span key={`${attack.id}-${index}`} className="absolute block h-[2px] rounded-full opacity-90" style={buildTrajectoryStyle(attack, index)} />
      ))}

      <div className="absolute left-1/2 top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.95)]" />
      <div className="absolute inset-[24%] rounded-full border border-cyan-300/20 [animation:sentinel-pulse_3.2s_ease-in-out_infinite]" />
      <div className="absolute inset-[33%] rounded-full border border-emerald-300/20 [animation:sentinel-pulse_4.5s_ease-in-out_infinite]" />
      {focus ? (
        <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 rounded-lg border border-cyan-300/35 bg-[rgba(3,12,16,0.82)] px-3 py-2 text-[10px] text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
          <p className="font-bold uppercase tracking-[0.16em]">{focus.type}</p>
          <p className="mt-1 text-cyan-100/75">
            {focus.sourceCountry} | {focus.sourceIP} | Port {focus.targetPort}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardLayout() {
  const { mounted, snapshot, actions } = useSocRuntime({
    overlayDurationMs: CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  })

  const [displayedRisk, setDisplayedRisk] = useState(2.4)
  const [replayCursor, setReplayCursor] = useState(72)

  const targetRisk = useMemo(() => {
    const density = snapshot.metrics?.attack.liveDensity ?? 2.2
    const pressure = snapshot.criticalQueue.length * 0.85
    const active = snapshot.alertCount * 0.045
    const value = Math.min(10, Math.max(1, density + pressure + active))
    return Number(value.toFixed(1))
  }, [snapshot.alertCount, snapshot.criticalQueue.length, snapshot.metrics?.attack.liveDensity])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDisplayedRisk((prev) => {
        const diff = targetRisk - prev
        if (Math.abs(diff) < 0.02) return targetRisk
        return Number((prev + diff * 0.22).toFixed(2))
      })
    }, 85)
    return () => window.clearInterval(timer)
  }, [targetRisk])

  if (!mounted) return null

  const attacks = [...snapshot.attacks].reverse()
  const recentAttacks = attacks.slice(0, 16)
  const transitions = [...snapshot.transitions].reverse().slice(0, 8)

  const healthScore = Math.max(
    10,
    Math.min(
      99,
      Math.round(
        100 - displayedRisk * 7.4 - snapshot.criticalQueue.length * 3.8 - snapshot.alertCount * 0.34,
      ),
    ),
  )

  const activeAnalysts = Math.max(
    2,
    (snapshot.metrics?.triageBoard.inProgress ?? 0) + Math.ceil(snapshot.alertCount / 6),
  )

  const mttr = Math.max(1, Math.round(snapshot.metrics?.sla.avgResolutionMinutes ?? 0))
  const attacksPerMinute = snapshot.metrics?.attack.attacksPerMinute ?? 0
  const totalLast24h = snapshot.metrics?.attack.totalLast24h ?? 0
  const liveDensity = snapshot.metrics?.attack.liveDensity ?? 0
  const mttd = Math.max(
    1, Number((60 / Math.max(1, attacksPerMinute)).toFixed(1)),
  )

  const barSeries = useMemo(() => {
    const now = Date.now()
    const buckets = Array.from({ length: 24 }, () => 0)
    for (const attack of attacks.slice(0, 140)) {
      const diff = now - new Date(attack.createdAt).getTime()
      if (!Number.isFinite(diff) || diff < 0) continue
      const minutes = Math.floor(diff / 60_000)
      if (minutes > 23) continue
      const index = 23 - minutes
      const weight = attack.severity === 'critical' ? 3 : attack.severity === 'high' ? 2 : 1
      buckets[index] += weight
    }
    const max = Math.max(1, ...buckets)
    return buckets.map((value) => Math.max(8, Math.round((value / max) * 100)))
  }, [attacks])

  const replayThreshold = Math.round((replayCursor / 100) * (barSeries.length - 1))

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[var(--bg-primary)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.10),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(255,68,68,0.10),transparent_42%),linear-gradient(120deg,rgba(15,23,42,0.25),rgba(30,41,59,0.05))]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:42px_42px] [animation:sentinel-grid-parallax_18s_linear_infinite]" />

      {snapshot.overlayActive && <CriticalOverlayFx cycle={snapshot.overlayCycle} />}

      <div className="relative z-10 flex h-full flex-col gap-3 p-3 md:p-4">
        <WarCard
          title="Sentinel Prime"
          subtitle="War Room Command Deck"
          right={
            <div className="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                className="rounded border border-emerald-400/35 px-2 py-1 text-emerald-300 hover:bg-emerald-400/10"
                onClick={() => void actions.refreshMetrics()}
              >
                sync metrics
              </button>
              <button
                type="button"
                className="rounded border border-cyan-400/35 px-2 py-1 text-cyan-300 hover:bg-cyan-400/10"
                onClick={() => void actions.refreshSummary()}
              >
                sync summary
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto_auto_auto]">
            <HealthGauge score={healthScore} />
            <HeaderMiniStat label="Active Analysts" value={activeAnalysts} colorClass="text-emerald-200" />
            <HeaderMiniStat label="Threats / Min" value={attacksPerMinute} colorClass="text-cyan-200" />
            <HeaderMiniStat label="24h Incidents" value={totalLast24h} colorClass="text-orange-200" />
          </div>
        </WarCard>

        <section className="grid min-h-[560px] grid-cols-1 gap-3 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <WarCard
            title="Incident Stream"
            subtitle="Live tactical feed"
            className="min-h-[460px]"
          >
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {recentAttacks.length === 0 ? (
                <p className="text-sm text-slate-400">No incidents in the stream yet.</p>
              ) : (
                recentAttacks.map((attack) => (
                  <article
                    key={attack.id}
                    className={`rounded-lg border px-3 py-2 ${
                      attack.severity === 'critical'
                        ? 'border-red-400/55 bg-red-500/12 shadow-[0_0_20px_rgba(255,68,68,0.25)]'
                        : attack.severity === 'high'
                          ? 'border-orange-400/45 bg-orange-500/10'
                          : 'border-cyan-400/35 bg-cyan-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cardTone(attack.severity)}`}>
                        {attack.severity}
                      </span>
                      {attack.severity === 'critical' ? (
                        <span className="rounded border border-red-400/65 bg-red-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-100 animate-pulse">
                          Critical
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-100">{attack.type}</p>
                    <p className="text-[11px] text-slate-300/75">
                      {attack.sourceIP} | {attack.sourceCountry} | Port {attack.targetPort}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatClock(attack.createdAt)}</p>
                  </article>
                ))
              )}
            </div>
          </WarCard>

          <WarCard
            title="Global Threat Hologram"
            subtitle="Real-time trajectories and global pressure field"
            className="min-h-[460px]"
            right={
              <div className="flex items-center gap-2 text-[10px]">
                <span className="rounded border border-cyan-400/35 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                  live trajectories
                </span>
              </div>
            }
          >
            <HoloGlobe attacks={attacks} />
          </WarCard>

          <WarCard
            title="Response Widgets"
            subtitle="MTTR / MTTD high-contrast panel"
            className="min-h-[460px] font-mono"
          >
            <div className="space-y-3">
              <article className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/80">MTTR</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-cyan-100">{mttr}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/60">minutes to respond</p>
              </article>

              <article className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-orange-200/85">MTTD</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-orange-100">{mttd}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-orange-200/65">minutes to detect</p>
              </article>

              <article className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/80">Live Density</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-emerald-100">{liveDensity}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/65">signal pressure index</p>
              </article>

              <article className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">Critical Queue</p>
                {snapshot.criticalQueue.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-100/55">Queue is currently clear.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {snapshot.criticalQueue.slice(0, 4).map((incident) => (
                      <li key={incident.id} className="rounded border border-red-400/35 bg-red-500/10 px-2 py-2">
                        <p className="text-[11px] font-semibold text-red-100">{incident.type}</p>
                        <p className="text-[10px] text-red-100/70">{incident.sourceCountry} | {incident.sourceIP}</p>
                        <button
                          type="button"
                          className="mt-2 rounded border border-red-400/45 px-2 py-1 text-[10px] uppercase tracking-wider text-red-200 hover:bg-red-500/20"
                          onClick={() => actions.openReport(incident.id)}
                        >
                          open report
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="rounded-xl border border-slate-500/30 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300/80">Transition Feed</p>
                {transitions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No transition records yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {transitions.map((transition, index) => (
                      <li key={`${transition.at}-${index}`} className="rounded border border-slate-500/30 bg-slate-800/30 px-2 py-1.5">
                        <p className="text-[10px] text-slate-200">
                          {transition.from} {'->'} {transition.to}
                        </p>
                        <p className="text-[9px] text-slate-400">{formatClock(transition.at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </WarCard>
        </section>

        <WarCard title="Timeline Replay" subtitle="Time-bar and frequency spike analytics">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-500/30 bg-black/25 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-400">
                <span>Replay Cursor</span>
                <span>{replayCursor}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={replayCursor}
                onChange={(event) => setReplayCursor(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
              />
            </div>

            <div className="rounded-lg border border-cyan-400/25 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Log Frequency Spikes</p>
              <div className="mt-3 flex h-28 items-end gap-1">
                {barSeries.map((value, index) => {
                  const active = index <= replayThreshold
                  const danger = value > 72
                  return (
                    <span
                      key={index}
                      className={`w-full rounded-t-sm transition-all ${danger ? 'bg-red-400/80' : 'bg-cyan-400/70'}`}
                      style={{
                        height: `${value}%`,
                        opacity: active ? 1 : 0.26,
                        boxShadow: active ? `0 0 10px ${danger ? 'rgba(255,68,68,0.45)' : 'rgba(34,211,238,0.45)'}` : 'none',
                      }}
                    />
                  )
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-slate-500">
                <span>T-24m</span>
                <span>T-12m</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        </WarCard>
      </div>

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

      <style jsx global>{`
        @keyframes sentinel-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes sentinel-pulse {
          0%,
          100% {
            opacity: 0.28;
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.04);
          }
        }

        @keyframes sentinel-comet {
          0% {
            opacity: 0;
            filter: blur(2px);
          }
          20% {
            opacity: 1;
            filter: blur(0);
          }
          75% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            filter: blur(1px);
          }
        }

        @keyframes sentinel-scan {
          0%,
          100% {
            transform: scale(0.98);
            opacity: 0.34;
          }
          50% {
            transform: scale(1.03);
            opacity: 0.9;
          }
        }

        @keyframes sentinel-grid-parallax {
          from {
            transform: translateY(0px);
          }
          to {
            transform: translateY(42px);
          }
        }
      `}</style>
    </div>
  )
}
