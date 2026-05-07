'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, Search, ShieldOff, CheckCircle2 } from 'lucide-react'

export type ToastKind = 'promote' | 'investigate' | 'contain' | 'resolve'

export interface Toast {
  id: string
  kind: ToastKind
  incidentId: string
}

interface ToastConfig {
  label: string
  status: string
  icon: typeof CircleCheck
  borderColor: string
  textColor: string
  iconColor: string
}

const TOAST_CONFIG: Record<ToastKind, ToastConfig> = {
  promote: {
    label: 'Vaka açıldı',
    status: 'OPEN',
    icon: CircleCheck,
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-100',
    iconColor: 'text-emerald-400',
  },
  investigate: {
    label: 'İnceleme başladı',
    status: 'INVESTIGATING',
    icon: Search,
    borderColor: 'border-cyan-500/40',
    textColor: 'text-cyan-100',
    iconColor: 'text-cyan-400',
  },
  contain: {
    label: 'İzolasyon uygulandı',
    status: 'CONTAINED',
    icon: ShieldOff,
    borderColor: 'border-rose-500/40',
    textColor: 'text-rose-100',
    iconColor: 'text-rose-400',
  },
  resolve: {
    label: 'Vaka kapatıldı',
    status: 'RESOLVED',
    icon: CheckCircle2,
    borderColor: 'border-slate-500/40',
    textColor: 'text-slate-100',
    iconColor: 'text-slate-400',
  },
}

const TOAST_DURATION_MS = 4000
const TOAST_FADE_MS = 200

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const cfg = TOAST_CONFIG[toast.kind]
  const Icon = cfg.icon

  useEffect(() => {
    const enterFrame = window.requestAnimationFrame(() => setVisible(true))
    const exitTimer = window.setTimeout(() => {
      setVisible(false)
      window.setTimeout(() => onDismiss(toast.id), TOAST_FADE_MS)
    }, TOAST_DURATION_MS)
    return () => {
      window.cancelAnimationFrame(enterFrame)
      window.clearTimeout(exitTimer)
    }
  }, [toast.id, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`min-w-[260px] rounded-lg border bg-[#0a1612]/95 backdrop-blur-sm px-3 py-2.5 shadow-lg ${cfg.borderColor} transition-all duration-200 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${cfg.textColor}`}>{cfg.label}</div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
            {toast.incidentId} → {cfg.status}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  )
}
