'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileText, Shield, X } from 'lucide-react'
import type { AttackEvent } from '@/lib/dashboard-types'

interface CriticalAlertPanelProps {
  queue: AttackEvent[]
  open: boolean
  onReport: (attack: AttackEvent) => void
  onDismiss: (id: number) => void
  onClose: () => void
}

const SEVERITY_STYLE: Record<AttackEvent['severity'], { label: string; tone: string; badge: string }> = {
  critical: {
    label: 'CRITICAL',
    tone: 'text-red-200',
    badge: 'border-red-400/50 bg-red-500/20 text-red-200',
  },
  high: {
    label: 'HIGH',
    tone: 'text-amber-200',
    badge: 'border-amber-400/50 bg-amber-500/20 text-amber-200',
  },
  low: {
    label: 'LOW',
    tone: 'text-cyan-200',
    badge: 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200',
  },
}

const TYPE_DESCRIPTION: Record<string, string> = {
  'RCE Attempt': 'Remote code execution pattern observed on exposed surface.',
  'SQL Injection': 'Database-oriented payload signature detected from source.',
  'SSH Brute Force': 'Credential stuffing or brute-force activity detected on SSH.',
  DDoS: 'Sustained service saturation activity has exceeded baseline.',
  'Port Scan': 'Recon sequence indicates broad target enumeration.',
  Phishing: 'Social engineering vector with credential harvest indicators.',
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function CriticalAlertPanel({
  queue,
  open,
  onReport,
  onDismiss,
  onClose,
}: CriticalAlertPanelProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const prevOpen = useRef(false)

  useEffect(() => {
    if (open && !prevOpen.current) {
      setExiting(false)
      setVisible(true)
    }
    if (!open && prevOpen.current && visible) {
      setExiting(true)
      const timeout = setTimeout(() => setVisible(false), 220)
      return () => clearTimeout(timeout)
    }
    prevOpen.current = open
  }, [open, visible])

  const items = useMemo(() => [...queue].reverse(), [queue])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,2,10,0.78)] p-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-red-500/50 bg-[linear-gradient(165deg,#11040d_0%,#06080f_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(239,68,68,0.25)] transition-all duration-200 ${exiting ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'}`}
      >
        <header className="flex items-center justify-between border-b border-red-500/25 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/50 bg-red-500/15">
              <AlertTriangle className="h-4 w-4 text-red-300" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Critical Security Incident</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-red-200/60">
                deterministic response queue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <span className="rounded-full border border-red-400/40 bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-100">
                {queue.length}
              </span>
            )}
            <button
              type="button"
              className="rounded border border-red-500/35 p-1 text-red-200/70 hover:bg-red-500/10 hover:text-red-100"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-8">
              <Shield className="h-10 w-10 text-emerald-300/60" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/75">Queue clear</p>
              <p className="text-[11px] text-emerald-100/45">No active critical incident.</p>
            </div>
          ) : (
            items.map((attack) => {
              const sev = SEVERITY_STYLE[attack.severity]
              const description = TYPE_DESCRIPTION[attack.type] ?? 'Incident requires analyst validation and report generation.'

              return (
                <article key={attack.id} className="rounded-lg border border-red-400/25 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-red-100">{attack.type}</p>
                      <p className="mt-1 text-[11px] text-slate-300/70">{description}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sev.badge}`}>
                      {sev.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded border border-slate-700/60 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Source IP</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-200">{attack.sourceIP}</p>
                    </div>
                    <div className="rounded border border-slate-700/60 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Country</p>
                      <p className={`mt-0.5 text-[11px] font-semibold ${sev.tone}`}>{attack.sourceCountry}</p>
                    </div>
                    <div className="rounded border border-slate-700/60 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Target Port</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-amber-200">{attack.targetPort}</p>
                    </div>
                    <div className="rounded border border-slate-700/60 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Detected</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-200">{formatTime(attack.createdAt)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-emerald-400/45 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/20"
                      onClick={() => onReport(attack)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Create report
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-400/45 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/20"
                      onClick={() => onDismiss(attack.id)}
                    >
                      Dismiss incident
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
