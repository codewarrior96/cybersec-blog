'use client'

import React, { useEffect, useMemo, useRef, useState, type MouseEventHandler } from 'react'

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE'
type TelemetryCaseFilter = 'ALL' | 'NO_CASE' | 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'FALSE_POSITIVE'
type Protocol = 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'DNS'

interface TimelineEntry {
  id: string
  time: string
  desc: string
  type: string
}

export interface TelemetryThreatEvent {
  id: string
  timestamp: string
  sev: Severity
  type: string
  source: string
  node: string
  region: string
  protocol: Protocol
  port: number
}

export interface TelemetryIncident {
  id: string
  sev: Severity
  time: string
  label: string
  source: string
  node: string
  region: string
  status: IncidentStatus
  sla: number
  events: string[]
  timeline: TimelineEntry[]
}

interface TelemetryRow {
  event: TelemetryThreatEvent
  linkedIncident: TelemetryIncident | null
  caseStatus: TelemetryCaseFilter | IncidentStatus
  relatedCount: number
}

interface TelemetryStreamPanelProps {
  visibleEvents: TelemetryThreatEvent[]
  selectedEventId: string | null
  mapFilter: string | null
  incidentByEventId: Map<string, TelemetryIncident>
  onEventSelect: (id: string) => void
  onPromote: (event: TelemetryThreatEvent) => void
  onReport: (event: TelemetryThreatEvent) => void
  onInvestigate: (event: TelemetryThreatEvent) => void
  onContain: (event: TelemetryThreatEvent) => void
  onDismiss: (event: TelemetryThreatEvent) => void
  formatTime: (iso: string) => string
  regionLabels: Record<string, string>
}

const severityRail: Record<Severity, { line: string; glow: string; text: string; pill: string; dot: string; accent: string }> = {
  CRITICAL: {
    line: 'from-rose-400 via-rose-500 to-rose-800',
    glow: 'shadow-[0_0_22px_rgba(244,63,94,0.24)]',
    text: 'text-rose-100',
    pill: 'border-rose-500/45 bg-rose-950/30 text-rose-200',
    dot: '#fb7185',
    accent: '#fb7185',
  },
  HIGH: {
    line: 'from-amber-300 via-amber-500 to-orange-700',
    glow: 'shadow-[0_0_22px_rgba(245,158,11,0.20)]',
    text: 'text-amber-100',
    pill: 'border-amber-500/45 bg-amber-950/30 text-amber-200',
    dot: '#f59e0b',
    accent: '#fbbf24',
  },
  MEDIUM: {
    line: 'from-emerald-300 via-emerald-400 to-teal-700',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.16)]',
    text: 'text-emerald-100',
    pill: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200',
    dot: '#34d399',
    accent: '#34d399',
  },
  LOW: {
    line: 'from-[#8fffd4] via-[#53d9b0] to-[#1f7d68]',
    glow: 'shadow-[0_0_18px_rgba(143,255,212,0.14)]',
    text: 'text-[#dffef3]',
    pill: 'border-[#65d7b7]/35 bg-[#0d2118] text-[#b8ffdf]',
    dot: '#8fffd4',
    accent: '#8fffd4',
  },
}

const caseTone: Record<TelemetryCaseFilter | IncidentStatus, string> = {
  ALL: 'border-[#325338] bg-[#102214] text-[#9fd6ad]',
  NO_CASE: 'border-[#274033] bg-[#0d1a12] text-[#6f8f78]',
  OPEN: 'border-[#325338] bg-[#102214] text-[#9fd6ad]',
  INVESTIGATING: 'border-cyan-500/40 bg-cyan-900/20 text-cyan-200',
  CONTAINED: 'border-emerald-500/40 bg-emerald-900/25 text-emerald-200',
  RESOLVED: 'border-[#406b4e] bg-[#13261a] text-[#b1e7c0]',
  FALSE_POSITIVE: 'border-amber-500/40 bg-amber-900/20 text-amber-200',
}

const severityDisplay: Record<'ALL' | Severity, string> = {
  ALL: 'Tümü',
  CRITICAL: 'Kritik',
  HIGH: 'Yüksek',
  MEDIUM: 'Orta',
  LOW: 'Düşük',
}

const caseStateDisplay: Record<TelemetryCaseFilter | IncidentStatus, string> = {
  ALL: 'Tümü',
  NO_CASE: 'Vaka Yok',
  OPEN: 'Açık',
  INVESTIGATING: 'İnceleniyor',
  CONTAINED: 'İzole',
  RESOLVED: 'Çözüldü',
  FALSE_POSITIVE: 'Yanlış Pozitif',
}

function HeaderMetric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-[84px] rounded-lg border border-[#21402a] bg-[linear-gradient(180deg,#0e1d14,#08110d)] px-2 py-2 sm:min-w-[92px] sm:px-2.5">
      <div className="text-[7px] uppercase tracking-[0.22em] text-[#6f8f78]">{label}</div>
      <div className={`pt-1 text-[11px] font-semibold tracking-wide ${tone ?? 'text-slate-100'}`}>{value}</div>
    </div>
  )
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.22em] transition-colors ${
        active
          ? 'border-[#4b8c62] bg-[#183322] text-[#c4ffd8] shadow-[0_0_16px_rgba(91,255,160,0.08)]'
          : 'border-[#2a4a31] bg-[#0f1f13] text-[#89aa94] hover:bg-[#162a1b]'
      }`}
    >
      {children}
    </button>
  )
}

function TelemetryActionButton({
  label,
  disabled,
  onClick,
  tone,
  title,
}: {
  label: string
  disabled?: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
  tone: 'primary' | 'report' | 'investigate' | 'contain' | 'dismiss'
  title?: string
}) {
  const classes = {
    primary: 'border-[#2f5f3c] bg-[#122716] text-[#a9efbc] hover:bg-[#17311d]',
    report: 'border-violet-500/45 bg-violet-900/25 text-violet-100 hover:bg-violet-800/35',
    investigate: 'border-cyan-500/45 bg-cyan-900/25 text-cyan-100 hover:bg-cyan-800/35',
    contain: 'border-rose-500/45 bg-rose-900/30 text-rose-100 hover:bg-rose-800/40',
    dismiss: 'border-amber-500/45 bg-amber-900/25 text-amber-100 hover:bg-amber-800/35',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.22em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${classes[tone]}`}
    >
      {label}
    </button>
  )
}

function getRecommendedAction(row: TelemetryRow) {
  if (!row.linkedIncident) {
    if (row.event.sev === 'CRITICAL') return 'Servis etkisi yayılmadan önce izole et, ardından resmi vaka akışını başlat.'
    if (row.event.sev === 'HIGH') return 'Vaka aç ve odaklı analist incelemesini başlat.'
    return 'Yalnızca komşu telemetri paterni doğruluyorsa vakaya dönüştür.'
  }

  if (row.linkedIncident.status === 'OPEN') return 'Vakayı inceleme akışına taşı ve IOC bağlamıyla zenginleştir.'
  if (row.linkedIncident.status === 'INVESTIGATING') return 'Komşu telemetri ile korele et ve izolasyon hazır mı karar ver.'
  if (row.linkedIncident.status === 'CONTAINED') return 'İzolasyon kalitesini doğrularken bu kaydı izleme için bağlı tut.'
  if (row.linkedIncident.status === 'FALSE_POSITIVE') return 'Yeni bir korelasyon sinyali çıkmadıkça reddedilmiş durumda bırak.'
  return 'Yeni bir aksiyon uygulamadan önce mevcut vaka durumunu değerlendir.'
}

function describeImpact(row: TelemetryRow) {
  if (row.event.sev === 'CRITICAL') return 'Müdahale edilmezse servis sürekliliği veya erişim kontrolü hızla bozulabilir.'
  if (row.event.sev === 'HIGH') return 'Bu örüntü daha büyük bir vakaya dönüşmeden analist dikkatini hak ediyor.'
  if (row.event.sev === 'MEDIUM') return 'Bu sinyal anlamlı, ancak komşu telemetri ile doğrulanmalı.'
  return 'Düşük sinyalli olay. Panik nedeni değil; bağlam ve korelasyon için görünür kalsın.'
}

function getTimelinePreview(incident: TelemetryIncident | null) {
  if (!incident?.timeline?.length) return []
  return [...incident.timeline].slice(-3).reverse()
}

function TelemetryRowCard({
  row,
  selected,
  fresh,
  onSelect,
  onPromote,
  onReport,
  onInvestigate,
  onContain,
  onDismiss,
  formatTime,
  regionLabels,
}: {
  row: TelemetryRow
  selected: boolean
  fresh: boolean
  onSelect: () => void
  onPromote: () => void
  onReport: () => void
  onInvestigate: () => void
  onContain: () => void
  onDismiss: () => void
  formatTime: (iso: string) => string
  regionLabels: Record<string, string>
}) {
  const evt = row.event
  const linkedIncident = row.linkedIncident
  const linkedStatus = linkedIncident?.status ?? null
  const isContained = linkedStatus === 'CONTAINED'
  const isDismissed = linkedStatus === 'FALSE_POSITIVE'
  const rail = severityRail[evt.sev]
  const showPromoteAction = !linkedIncident
  const caseLabel: TelemetryCaseFilter | IncidentStatus = linkedIncident ? linkedStatus ?? 'OPEN' : 'NO_CASE'
  const recommendedAction = getRecommendedAction(row)
  const timelinePreview = getTimelinePreview(linkedIncident)
  const regionLabel = regionLabels[evt.region] ?? evt.region

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all ${
        selected
          ? 'border-[#4c8f61] bg-[linear-gradient(180deg,rgba(18,48,30,0.94),rgba(10,22,14,0.95))] shadow-[0_0_0_1px_rgba(134,255,199,0.08),0_0_28px_rgba(43,255,161,0.08)]'
          : 'border-[#1f3826] bg-[linear-gradient(180deg,rgba(9,22,14,0.95),rgba(7,16,11,0.96))] hover:border-[#31533b] hover:bg-[linear-gradient(180deg,rgba(12,29,19,0.96),rgba(9,20,13,0.98))]'
      } ${fresh ? 'telemetry-row-fresh' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${rail.line} ${rail.glow}`} />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02),transparent_32%,transparent)] opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative grid gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.92fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.88fr)_minmax(240px,0.62fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: rail.dot, boxShadow: `0 0 12px ${rail.dot}` }} />
                <span className={`text-[8px] font-bold uppercase tracking-[0.24em] ${rail.text}`}>{evt.sev}</span>
                <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-[#5d7c67]">
                  {evt.protocol} / {evt.port}
                </span>
                {fresh && (
                  <span className="rounded-full border border-[#4c8f61] bg-[#183322] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.24em] text-[#caffdc]">
                    Yeni Sinyal
                  </span>
                )}
              </div>
              <div className={`mt-2 truncate text-[13px] font-semibold leading-tight ${rail.text}`}>{evt.type}</div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[10px] font-mono text-slate-400 tabular-nums">{formatTime(evt.timestamp)}</div>
              <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.22em] ${caseTone[caseLabel]}`}>
                {caseStateDisplay[caseLabel]}
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-[10px] sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-[#173124] bg-[#07120d] px-2.5 py-2">
              <div className="text-[7px] uppercase tracking-[0.22em] text-[#587564]">Kaynak</div>
              <div className="mt-1 truncate font-mono text-[#b9ffd4]">{evt.source}</div>
            </div>
            <div className="rounded-lg border border-[#173124] bg-[#07120d] px-2.5 py-2">
              <div className="text-[7px] uppercase tracking-[0.22em] text-[#587564]">Düğüm</div>
              <div className="mt-1 truncate font-mono text-slate-300">{evt.node}</div>
            </div>
            <div className="rounded-lg border border-[#173124] bg-[#07120d] px-2.5 py-2">
              <div className="text-[7px] uppercase tracking-[0.22em] text-[#587564]">Bölge</div>
              <div className="mt-1 truncate text-slate-200">{regionLabel}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[#183126] bg-[linear-gradient(180deg,#09140f,#07100c)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#8eb99a]">Operasyon Bağlamı</div>
            <div className="rounded-full border border-[#284538] bg-[#102116] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.22em] text-[#b4f4c8]">
              {row.relatedCount > 1 ? `${row.relatedCount} İlişkili` : linkedIncident ? linkedIncident.id : 'Tek Sinyal'}
            </div>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-slate-300">
            {linkedIncident
              ? `Bu telemetri kaydı aktif bir vakaya bağlı. Durum: ${caseStateDisplay[linkedIncident.status]}. Rapor ve aksiyon zinciri ${linkedIncident.id} üzerinden izleniyor.`
              : 'Bu kayıt henüz vakaya dönüştürülmedi. İlk adım olarak vaka açabilir, rapora dönüştürebilir veya izolasyon kararı verebilirsin.'}
          </div>
          <div className="mt-3 grid gap-2 text-[9px] md:grid-cols-2">
            <div className="rounded-lg border border-[#1c3628] bg-[#08130d] px-2.5 py-2">
              <div className="text-[7px] uppercase tracking-[0.22em] text-[#688873]">Etki Sinyali</div>
              <div className="mt-1 leading-relaxed text-slate-300">{describeImpact(row)}</div>
            </div>
            <div className="rounded-lg border border-[#1c3628] bg-[#08130d] px-2.5 py-2">
              <div className="text-[7px] uppercase tracking-[0.22em] text-[#688873]">Sonraki Adım</div>
              <div className="mt-1 leading-relaxed text-slate-300">{recommendedAction}</div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl border border-[#183126] bg-[linear-gradient(180deg,#0a1510,#07100b)] p-3 lg:col-span-2 xl:col-span-1 xl:min-w-[240px]">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#8eb99a]">Müdahale Aksiyonları</div>
            <div className="mt-2 text-[10px] leading-relaxed text-slate-400">
              {linkedIncident
                ? 'Mevcut vakayı derinleştir, izole et veya yanlış pozitif kararı ver.'
                : 'Olayı vakaya dönüştür, incelemeye al veya izolasyon başlat.'}
            </div>
          </div>
          <div className={`mt-4 grid gap-2 ${showPromoteAction ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-2'}`}>
            {showPromoteAction && (
              <TelemetryActionButton
                label="Vaka Aç"
                tone="primary"
                onClick={(event) => {
                  event?.stopPropagation?.()
                  onPromote()
                }}
                title="Telemetriyi vakaya dönüştür"
              />
            )}
            <TelemetryActionButton
              label="Rapor Oluştur"
              tone="report"
              onClick={(event) => {
                event?.stopPropagation?.()
                onReport()
              }}
              title={linkedIncident ? `${linkedIncident.id} için raporu aç` : 'Telemetriden doğrudan rapor oluştur'}
            />
            <TelemetryActionButton
              label="İncele"
              tone="investigate"
              onClick={(event) => {
                event?.stopPropagation?.()
                onInvestigate()
              }}
              title="Analist incelemesine geçir"
            />
            <TelemetryActionButton
              label="İzole Et"
              tone="contain"
              onClick={(event) => {
                event?.stopPropagation?.()
                onContain()
              }}
              disabled={isContained || isDismissed}
              title={isContained ? 'Zaten izole edildi' : isDismissed ? 'Reddedilen vaka izole edilemez' : 'Telemetriden izolasyon başlat'}
            />
            <TelemetryActionButton
              label="Kapat"
              tone="dismiss"
              onClick={(event) => {
                event?.stopPropagation?.()
                onDismiss()
              }}
              disabled={isDismissed}
              title={isDismissed ? 'Zaten kapatıldı' : 'Telemetriden yanlış pozitif olarak işaretle'}
            />
          </div>
        </div>
      </div>

      {selected && (
        <div className="border-t border-[#1d3323] bg-[linear-gradient(180deg,rgba(6,15,11,0.92),rgba(4,10,8,0.96))] px-3 py-4 sm:px-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="rounded-xl border border-[#1a3526] bg-[#07120d] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#8eb99a]">Hızlı İstihbarat</div>
                <div className="rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.22em]" style={{ borderColor: `${rail.accent}55`, color: rail.accent, background: `${rail.accent}12` }}>
                  {severityDisplay[evt.sev]} Öncelik
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-[#1b3225] bg-[#08130d] px-2.5 py-2">
                  <div className="text-[7px] uppercase tracking-[0.22em] text-[#688873]">Telemetri İmzası</div>
                  <div className="mt-1 text-[10px] text-slate-200">{evt.type}</div>
                </div>
                <div className="rounded-lg border border-[#1b3225] bg-[#08130d] px-2.5 py-2">
                  <div className="text-[7px] uppercase tracking-[0.22em] text-[#688873]">Protokol Yüzeyi</div>
                  <div className="mt-1 text-[10px] text-slate-200">{evt.protocol} / port {evt.port}</div>
                </div>
                <div className="rounded-lg border border-[#1b3225] bg-[#08130d] px-2.5 py-2">
                  <div className="text-[7px] uppercase tracking-[0.22em] text-[#688873]">Bölge Odağı</div>
                  <div className="mt-1 text-[10px] text-slate-200">{regionLabel}</div>
                </div>
                <div className="rounded-lg border border-[#1b3225] bg-[#08130d] px-2.5 py-2">
                  <div className="text-[7px] uppercase tracking-[0.22em] text-[#688873]">Kaynak Göstergesi</div>
                  <div className="mt-1 font-mono text-[10px] text-[#baffd8]">{evt.source}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#1a3526] bg-[#07120d] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#8eb99a]">Vaka Bağı</div>
                <div className="rounded-full border border-[#274636] bg-[#0d1b13] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.22em] text-[#b9ffd4]">
                  {linkedIncident ? `Bağlı ${linkedIncident.id}` : 'Vaka Bekliyor'}
                </div>
              </div>

              {timelinePreview.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {timelinePreview.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-[#1b3225] bg-[#08130d] px-2.5 py-2">
                      <div className="flex items-center justify-between gap-3 text-[8px] uppercase tracking-[0.22em] text-[#6f8f78]">
                        <span>{entry.type}</span>
                        <span className="font-mono">{formatTime(entry.time)}</span>
                      </div>
                      <div className="mt-1 text-[10px] leading-relaxed text-slate-300">{entry.desc}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-[#24402d] bg-[#08120d] px-3 py-4 text-[10px] leading-relaxed text-slate-400">
                  Bu telemetri kaydı için henüz timeline zenginleşmesi yok. Olay rapora veya vakaya dönüştüğünde burası otomatik olarak daha güçlü bağlamla dolacak.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TelemetryStreamPanel({
  visibleEvents,
  selectedEventId,
  mapFilter,
  incidentByEventId,
  onEventSelect,
  onPromote,
  onReport,
  onInvestigate,
  onContain,
  onDismiss,
  formatTime,
  regionLabels,
}: TelemetryStreamPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL')
  const [caseFilter, setCaseFilter] = useState<TelemetryCaseFilter>('ALL')
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const hasBootstrappedRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())

  const telemetryRows = useMemo<TelemetryRow[]>(() => {
    return visibleEvents.map((event) => {
      const linkedIncident = incidentByEventId.get(event.id) ?? null
      const caseStatus = (linkedIncident?.status ?? 'NO_CASE') as TelemetryCaseFilter | IncidentStatus
      const relatedCount = visibleEvents.filter((candidate) => candidate.id !== event.id && candidate.type === event.type && candidate.region === event.region).length + 1
      return { event, linkedIncident, caseStatus, relatedCount }
    })
  }, [incidentByEventId, visibleEvents])

  useEffect(() => {
    const currentIds = visibleEvents.map((event) => event.id)
    if (!hasBootstrappedRef.current) {
      seenIdsRef.current = new Set(currentIds)
      hasBootstrappedRef.current = true
      return
    }

    const unseen = currentIds.filter((id) => !seenIdsRef.current.has(id))
    if (!unseen.length) return

    seenIdsRef.current = new Set(currentIds)
    setFreshIds((prev) => {
      const next = new Set(prev)
      unseen.forEach((id) => next.add(id))
      return next
    })

    const timeout = window.setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev)
        unseen.forEach((id) => next.delete(id))
        return next
      })
    }, 2200)

    return () => window.clearTimeout(timeout)
  }, [visibleEvents])

  const filteredRows = useMemo(() => {
    return telemetryRows.filter((row) => {
      if (severityFilter !== 'ALL' && row.event.sev !== severityFilter) return false
      if (caseFilter === 'ALL') return true
      if (caseFilter === 'NO_CASE') return row.caseStatus === 'NO_CASE'
      return row.caseStatus === caseFilter
    })
  }, [caseFilter, severityFilter, telemetryRows])

  const visibleRows = filteredRows.slice(0, 5)
  const selectedTelemetryRow = selectedEventId
    ? telemetryRows.find((row) => row.event.id === selectedEventId) ?? null
    : null
  const selectedTelemetryEvent = selectedTelemetryRow?.event ?? null
  const selectedTelemetryIncident = selectedTelemetryRow?.linkedIncident ?? null

  const counts = useMemo(() => ({
    crit: filteredRows.filter((row) => row.event.sev === 'CRITICAL').length,
    high: filteredRows.filter((row) => row.event.sev === 'HIGH').length,
    investigating: filteredRows.filter((row) => row.caseStatus === 'INVESTIGATING').length,
    open: filteredRows.filter((row) => row.caseStatus === 'OPEN').length,
    contained: filteredRows.filter((row) => row.caseStatus === 'CONTAINED').length,
    noCase: filteredRows.filter((row) => row.caseStatus === 'NO_CASE').length,
  }), [filteredRows])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar -mx-3 -mb-3 mt-0 sm:-m-3 sm:mt-0">
      <div className="sticky top-0 z-20 border-b border-[#1d3323] bg-[linear-gradient(180deg,rgba(10,24,13,0.98),rgba(8,19,11,0.96))] backdrop-blur-sm">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[#163122] px-3 py-2 custom-scrollbar">
          <div className="mr-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#38ff9c] shadow-[0_0_10px_rgba(56,255,156,0.8)]" />
            <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#b5ffd4]">Telemetri Kontrol</span>
          </div>

          <HeaderMetric label="Seçili" value={selectedTelemetryEvent ? formatTime(selectedTelemetryEvent.timestamp) : 'YOK'} />
          <HeaderMetric label="Açık" value={counts.open} tone="text-[#b7ffd0]" />
          <HeaderMetric label="İncelenen" value={counts.investigating} tone="text-cyan-200" />
          <HeaderMetric label="İzole" value={counts.contained} tone="text-emerald-200" />
          <HeaderMetric label="Vakaya Bağlı Değil" value={counts.noCase} tone="text-[#99c9a8]" />

          <div className="ml-auto flex items-center gap-2">
            {selectedTelemetryIncident && (
              <span className="rounded-full border border-[#2a4a31] bg-[#0e1e12] px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.22em] text-[#9fe3b3]">
                Vaka {selectedTelemetryIncident.id}
              </span>
            )}
            <span className="rounded-full border border-[#2a4a31] bg-[#0e1e12] px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.22em] text-[#8db09a]">
              {mapFilter ? `Odak ${mapFilter}` : 'Genel Akış'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto px-3 py-2 custom-scrollbar">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[7px] uppercase tracking-[0.24em] text-[#6f8f78]">Önem</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <FilterChip key={`sev-${sev}`} active={severityFilter === sev} onClick={() => setSeverityFilter(sev)}>
                {severityDisplay[sev]}
              </FilterChip>
            ))}
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[7px] uppercase tracking-[0.24em] text-[#6f8f78]">Vaka Durumu</span>
            {(['ALL', 'NO_CASE', 'OPEN', 'INVESTIGATING', 'CONTAINED', 'FALSE_POSITIVE'] as const).map((item) => (
              <FilterChip key={`case-${item}`} active={caseFilter === item} onClick={() => setCaseFilter(item)}>
                {caseStateDisplay[item]}
              </FilterChip>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-[8px] font-mono uppercase tracking-[0.2em]">
            <span className="text-rose-300">Kritik {counts.crit}</span>
            <span className="text-amber-300">Yüksek {counts.high}</span>
            <span className="text-[#7aa989]">Satır {visibleRows.length}/{filteredRows.length}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        {visibleRows.map((row) => (
          <TelemetryRowCard
            key={row.event.id}
            row={row}
            selected={selectedEventId === row.event.id}
            fresh={freshIds.has(row.event.id)}
            onSelect={() => onEventSelect(row.event.id)}
            onPromote={() => {
              if (!row.linkedIncident) onPromote(row.event)
              else if (row.linkedIncident.status === 'OPEN') onInvestigate(row.event)
              else onPromote(row.event)
            }}
            onReport={() => onReport(row.event)}
            onInvestigate={() => onInvestigate(row.event)}
            onContain={() => onContain(row.event)}
            onDismiss={() => onDismiss(row.event)}
            formatTime={formatTime}
            regionLabels={regionLabels}
          />
        ))}

        {visibleRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#21402a] bg-[#08120c] px-4 py-10 text-center">
            <div className="text-[8px] font-bold uppercase tracking-[0.26em] text-[#6f8f78]">Telemetri Temiz</div>
            <div className="pt-2 text-[11px] text-slate-400">Mevcut filtre seti için görünür telemetri olayı yok.</div>
          </div>
        )}
      </div>

      <style jsx>{`
        .telemetry-row-fresh {
          animation: telemetry-row-fresh 2.2s ease-out;
        }

        @keyframes telemetry-row-fresh {
          0% {
            box-shadow: 0 0 0 1px rgba(112, 255, 174, 0.34), 0 0 0 0 rgba(56, 255, 156, 0.24), 0 0 28px rgba(56, 255, 156, 0.18);
            transform: translateY(-2px);
          }
          45% {
            box-shadow: 0 0 0 1px rgba(112, 255, 174, 0.2), 0 0 0 8px rgba(56, 255, 156, 0), 0 0 20px rgba(56, 255, 156, 0.12);
          }
          100% {
            box-shadow: none;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
