'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AlarmTransition, AttackEvent } from '@/lib/dashboard-types'
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

function formatMinuteClock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toneForSeverity(severity: AttackEvent['severity']) {
  if (severity === 'critical') return 'text-red-400 border-red-500/40 bg-red-500/10'
  if (severity === 'high') return 'text-amber-300 border-amber-400/40 bg-amber-500/10'
  return 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10'
}

function transitionLabel(transition: AlarmTransition) {
  if (transition.reason === 'critical_ingest') return 'Critical event ingested'
  if (transition.reason === 'overlay_timeout') return 'Overlay timeout completed'
  if (transition.reason === 'queue_drained') return 'Queue drained'
  if (transition.reason === 'panel_closed') return 'Panel closed'
  return 'Manual reset'
}

function GlassPanel({
  title,
  right,
  children,
  className = '',
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-emerald-400/20 bg-[rgba(3,14,11,0.74)] shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_24px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`}
    >
      <header className="flex items-center justify-between border-b border-emerald-400/15 px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300/90">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string | number
  hint: string
  color: string
}) {
  return (
    <article className="rounded-xl border border-emerald-400/20 bg-[rgba(4,18,14,0.75)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/60">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-wide" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-emerald-100/45">{hint}</p>
    </article>
  )
}

export default function DashboardLayout() {
  const { mounted, snapshot, actions } = useSocRuntime({
    initialDemoMode: false,
    overlayDurationMs: CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  })

  const [displayedRisk, setDisplayedRisk] = useState(2.4)

  const targetRisk = useMemo(() => {
    const density = snapshot.metrics?.attack.liveDensity ?? 2.2
    const pressure = snapshot.criticalQueue.length * 0.8
    const active = snapshot.alertCount * 0.05
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
    }, 80)
    return () => window.clearInterval(timer)
  }, [targetRisk])

  if (!mounted) return null

  const attacks = [...snapshot.attacks].reverse()
  const recentAttacks = attacks.slice(0, 12)
  const transitionFeed = [...snapshot.transitions].reverse().slice(0, 10)

  const nowIso = new Date().toISOString()
  const lastUpdate = formatMinuteClock(nowIso)
  const levelLabel =
    displayedRisk >= 8 ? 'CRITICAL' : displayedRisk >= 6 ? 'HIGH' : displayedRisk >= 4 ? 'MEDIUM' : 'STABLE'
  const levelColor =
    displayedRisk >= 8 ? '#ef4444' : displayedRisk >= 6 ? '#f97316' : displayedRisk >= 4 ? '#facc15' : '#22c55e'

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#010605] text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(16,185,129,0.16),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(59,130,246,0.12),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background:linear-gradient(to_right,rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

      {snapshot.overlayActive && <CriticalOverlayFx cycle={snapshot.overlayCycle} />}

      <div className="relative z-10 flex h-full flex-col gap-3 p-3 md:p-4">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <MetricCard label="SOC RISK" value={displayedRisk.toFixed(1)} hint={levelLabel} color={levelColor} />
          <MetricCard label="ACTIVE ALERTS" value={snapshot.alertCount} hint="open incidents" color="#f87171" />
          <MetricCard label="CRITICAL QUEUE" value={snapshot.criticalQueue.length} hint="panel pipeline" color="#fb7185" />
          <MetricCard label="CVSS 9+" value={snapshot.cveCount} hint="daily radar" color="#f59e0b" />
          <MetricCard
            label="ATTACK / MIN"
            value={snapshot.metrics?.attack.attacksPerMinute ?? 0}
            hint="live density"
            color="#22d3ee"
          />
          <MetricCard
            label="LAST SYNC"
            value={lastUpdate}
            hint={snapshot.demoMode ? 'demo mode' : 'live mode'}
            color="#4ade80"
          />
        </section>

        <section className="grid min-h-[520px] grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <GlassPanel title="Live Threat River" className="min-h-[300px]">
            {recentAttacks.length === 0 ? (
              <p className="text-sm text-emerald-100/40">No live attack events yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentAttacks.map((attack) => (
                  <li
                    key={attack.id}
                    className="rounded-lg border border-emerald-400/10 bg-black/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${toneForSeverity(attack.severity)}`}>
                        {attack.severity}
                      </span>
                      <span className="text-[10px] text-emerald-200/50">{formatClock(attack.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-emerald-100">{attack.type}</p>
                    <p className="text-[11px] text-emerald-100/55">
                      {attack.sourceIP} | {attack.sourceCountry} | Port {attack.targetPort}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel
            title="Command Surface"
            className="min-h-[520px]"
            right={
              <div className="flex gap-2 text-[10px]">
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
                  onClick={() => actions.toggleDemoMode()}
                >
                  {snapshot.demoMode ? 'live mode' : 'demo mode'}
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/20 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/65">Critical Queue</p>
                {snapshot.criticalQueue.length === 0 ? (
                  <p className="mt-3 text-sm text-emerald-100/40">No active critical incidents.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {snapshot.criticalQueue.slice(0, 5).map((incident) => (
                      <li key={incident.id} className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
                        <p className="text-xs font-semibold text-red-200">{incident.type}</p>
                        <p className="text-[11px] text-red-100/70">{incident.sourceCountry} | {incident.sourceIP}</p>
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
              </div>

              <div className="rounded-xl border border-emerald-400/20 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/65">Alarm Transition Feed</p>
                {transitionFeed.length === 0 ? (
                  <p className="mt-3 text-sm text-emerald-100/40">No transition history yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {transitionFeed.map((transition, index) => (
                      <li key={`${transition.at}-${index}`} className="rounded-lg border border-emerald-400/15 bg-black/20 px-3 py-2">
                        <p className="text-xs text-emerald-100">{transitionLabel(transition)}</p>
                        <p className="text-[10px] text-emerald-200/50">
                          {transition.from} {'->'} {transition.to} | {formatMinuteClock(transition.at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="Intel Stack" className="min-h-[300px]">
            <div className="space-y-3">
              <article className="rounded-xl border border-emerald-400/20 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/65">Top Countries (24s)</p>
                {(snapshot.metrics?.attack.topCountries ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-100/40">Waiting for telemetry data.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {(snapshot.metrics?.attack.topCountries ?? []).slice(0, 5).map((country) => (
                      <li key={country.name} className="flex items-center justify-between text-xs">
                        <span className="text-emerald-100/80">{country.name}</span>
                        <span className="text-emerald-300">{country.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="rounded-xl border border-emerald-400/20 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/65">Top Tags</p>
                {(snapshot.metrics?.attack.topTags ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-100/40">Tag flow is not available yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {(snapshot.metrics?.attack.topTags ?? []).slice(0, 8).map((tag) => (
                      <li key={tag.name} className="rounded border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                        #{tag.name} | {tag.count}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="rounded-xl border border-emerald-400/20 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/65">Quick Actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-emerald-400/35 px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-400/10"
                    onClick={() => void actions.refreshSummary()}
                  >
                    sync summary
                  </button>
                  <button
                    type="button"
                    className="rounded border border-amber-400/35 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-400/10"
                    onClick={() => void actions.ingestLiveAttack()}
                  >
                    force ingest
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-400/35 px-2 py-1 text-[10px] uppercase tracking-wider text-red-200 hover:bg-red-400/10"
                    onClick={() => actions.manualReset()}
                  >
                    runtime reset
                  </button>
                </div>
              </article>
            </div>
          </GlassPanel>
        </section>

        <GlassPanel title="Forensic Timeline And Response Playbook" className="min-h-[170px]">
          {attacks.length === 0 ? (
            <p className="text-sm text-emerald-100/40">Waiting for enough events to populate timeline.</p>
          ) : (
            <div className="space-y-3">
              <div className="relative h-2 rounded-full bg-emerald-950/80">
                {attacks.slice(0, 14).map((attack, index) => (
                  <span
                    key={attack.id}
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-emerald-200/40 bg-emerald-300"
                    style={{ left: `${(index / Math.max(13, attacks.slice(0, 14).length - 1)) * 100}%` }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {attacks.slice(0, 3).map((attack) => (
                  <article key={attack.id} className="rounded-lg border border-emerald-400/15 bg-black/20 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-100">{attack.type}</p>
                    <p className="text-[11px] text-emerald-200/55">{formatClock(attack.createdAt)} | {attack.sourceCountry}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
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
    </div>
  )
}
