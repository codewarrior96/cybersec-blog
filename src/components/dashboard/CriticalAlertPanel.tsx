'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileText, Shield, X, Zap } from 'lucide-react'

export interface CriticalAlertQueueItem {
  id: string
  sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  label: string
  source: string
  node: string
  region: string
  time: string
}

interface CriticalAlertPanelProps {
  queue: CriticalAlertQueueItem[]
  open: boolean
  onReport: (incident: CriticalAlertQueueItem) => void
  onDismiss: (id: string) => void
  onClose: () => void
}

const SEV_COLOR: Record<CriticalAlertQueueItem['sev'], string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#8b5cf6',
}

function timeStr(iso: string) {
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

function getIncidentIcon(label: string) {
  const value = label.toLowerCase()
  if (value.includes('ransom')) return '💀'
  if (value.includes('sql')) return '🔓'
  if (value.includes('auth')) return '🔑'
  if (value.includes('flood')) return '⚡'
  if (value.includes('exfil')) return '📤'
  if (value.includes('c2')) return '🛰'
  return '⚠'
}

function getIncidentDescription(label: string) {
  const value = label.toLowerCase()
  if (value.includes('ransom')) return 'Ransomware payload tetiklendi, hizli mudahale gerekli.'
  if (value.includes('sql')) return 'Veritabani odakli enjeksiyon aktivitesi algilandi.'
  if (value.includes('auth')) return 'Kimlik dogrulama atlatma veya yetki asimi sinyali bulundu.'
  if (value.includes('flood')) return 'Hedef servis uzerinde yogun trafik kaynakli baski olusuyor.'
  if (value.includes('exfil')) return 'Veri sizdirma veya buyuk veri cikisi supheli sekilde gozlendi.'
  if (value.includes('c2')) return 'Komuta kontrol benzeri surekli baglanti denemeleri tespit edildi.'
  return 'Bilinmeyen ancak kritik seviyede bir tehdit deseni algilandi.'
}

function ScanLine() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
      <div
        className="absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), rgba(255,255,255,0.3), rgba(239,68,68,0.6), transparent)',
          animation: 'scan-sweep 2.4s linear infinite',
        }}
      />
    </div>
  )
}

function CornerDeco({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: '2px solid', borderLeft: '2px solid' },
    tr: { top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' },
    bl: { bottom: 0, left: 0, borderBottom: '2px solid', borderLeft: '2px solid' },
    br: { bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' },
  }

  return (
    <div
      className="absolute w-4 h-4 pointer-events-none"
      style={{ ...styles[pos], borderColor: 'rgba(239,68,68,0.7)' }}
    />
  )
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
      const timer = setTimeout(() => setVisible(false), 260)
      return () => clearTimeout(timer)
    }
    prevOpen.current = open
  }, [open, visible])

  if (!visible) return null

  const latest = [...queue].reverse()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center font-mono"
      style={{
        background: 'rgba(6,0,15,0.82)',
        animation: exiting ? 'alert-exit 0.25s ease-in both' : 'backdrop-in 0.3s ease-out both',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`relative flex flex-col ${exiting ? 'alert-exit' : 'alert-entrance alert-glow'}`}
        style={{
          width: 'min(520px, 92vw)',
          maxHeight: 'min(640px, 88vh)',
          background: 'linear-gradient(160deg, #100010 0%, #0a000f 60%, #14000a 100%)',
          border: '1px solid rgba(239,68,68,0.45)',
          borderRadius: 12,
        }}
      >
        <CornerDeco pos="tl" />
        <CornerDeco pos="tr" />
        <CornerDeco pos="bl" />
        <CornerDeco pos="br" />
        <ScanLine />

        <div
          className="relative flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(239,68,68,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8">
              <div
                className="absolute w-8 h-8 rounded-full animate-ping"
                style={{ background: 'rgba(239,68,68,0.25)' }}
              />
              <div
                className="relative w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-red-400 font-black tracking-[0.2em] text-xs uppercase critical-flicker">
                Critical Security Alert
              </span>
              <span className="text-[9px] text-red-600 tracking-widest uppercase mt-0.5">
                P1 . auto detected . immediate response required
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <span
                className="alert-badge-pop bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{ boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
              >
                {queue.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-red-400 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {latest.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <Shield className="w-12 h-12 text-slate-700" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-slate-500 text-xs tracking-widest uppercase">System Secure</div>
                <div className="text-slate-700 text-[10px] mt-1">Critical queue is empty.</div>
              </div>
            </div>
          )}

          {latest.map((incident, index) => {
            const color = SEV_COLOR[incident.sev] ?? '#ef4444'

            return (
              <div
                key={incident.id}
                className="relative rounded-lg overflow-hidden"
                style={{
                  border: `1px solid ${color}30`,
                  background: `linear-gradient(135deg, ${color}06 0%, transparent 60%)`,
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
                  style={{ background: `linear-gradient(180deg, ${color}, ${color}55)`, boxShadow: `0 0 8px ${color}` }}
                />

                <div className="pl-4 pr-3 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{getIncidentIcon(incident.label)}</span>
                      <span className="font-black text-xs tracking-wider" style={{ color }}>
                        {incident.label.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider"
                        style={{
                          color,
                          background: `${color}18`,
                          border: `1px solid ${color}40`,
                          boxShadow: `0 0 6px ${color}30`,
                        }}
                      >
                        {incident.sev}
                      </span>
                      <span className="text-[9px] text-slate-600 tabular-nums">{timeStr(incident.time)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 leading-relaxed">
                    {getIncidentDescription(incident.label)}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['SOURCE IP', incident.source, '#94a3b8'],
                      ['REGION', incident.region, color],
                      ['TARGET NODE', incident.node, '#f59e0b'],
                    ] as [string, string, string][]).map(([label, value, valueColor]) => (
                      <div
                        key={label}
                        className="rounded px-2 py-1.5"
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div className="text-[8px] text-slate-600 tracking-widest uppercase mb-0.5">{label}</div>
                        <div className="text-[10px] font-bold tabular-nums truncate" style={{ color: valueColor }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => onReport(incident)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all duration-200 hover:brightness-125 active:scale-95"
                      style={{
                        background: `${color}15`,
                        border: `1px solid ${color}45`,
                        color,
                        boxShadow: `0 0 12px ${color}20`,
                      }}
                    >
                      <FileText className="w-3 h-3" />
                      Rapor Olustur
                    </button>
                    <button
                      onClick={() => onDismiss(incident.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 border border-slate-800 transition-colors"
                    >
                      <Zap className="w-3 h-3" />
                      Kapat
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="shrink-0 flex items-center justify-between px-5 py-2.5"
          style={{ borderTop: '1px solid rgba(239,68,68,0.12)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] text-slate-600 tracking-widest uppercase">
              Critical incidents are auto-detected
            </span>
          </div>
          <span className="text-[9px] text-red-900 font-bold tracking-widest">P1 PRIORITY</span>
        </div>
      </div>
    </div>
  )
}
