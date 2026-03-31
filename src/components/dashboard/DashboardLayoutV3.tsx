'use client'

import React, { useEffect, useState } from 'react'
import ThreatBanner from '@/components/dashboard/ThreatBanner'
import CyberNewsWidget from '@/components/dashboard/CyberNewsWidget'
import AlertManagementWidget from '@/components/dashboard/AlertManagementWidget'
import ThreatIntelWidget from '@/components/dashboard/ThreatIntelWidget'
import CriticalAlertPanel from '@/components/dashboard/CriticalAlertPanel'
import AttackReportModal from '@/components/dashboard/AttackReportModal'
import CriticalOverlayFx from '@/components/dashboard/CriticalOverlayFx'
import { useSocRuntime } from '@/lib/soc-runtime/use-soc-runtime'
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

function StatCard({ label, value, sub, color = '#00ff88' }: StatCardProps) {
  return (
    <div
      className="flex flex-col justify-between px-3 py-2.5 rounded-lg border"
      style={{
        background: `${color}05`,
        borderColor: `${color}20`,
      }}
    >
      <span className="text-[9px] uppercase tracking-widest font-bold text-[#525252]">{label}</span>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span
          className="text-[20px] font-black tabular-nums leading-none"
          style={{ color, textShadow: `0 0 20px ${color}60` }}
        >
          {value}
        </span>
        {sub && <span className="text-[9px] text-[#525252]">{sub}</span>}
      </div>
    </div>
  )
}

export default function DashboardLayoutV3() {
  const { mounted, snapshot, actions } = useSocRuntime({
    initialDemoMode: false,
    overlayDurationMs: CRITICAL_EFFECT_TOKENS.overlayDurationMs,
  })

  const [threatScore, setThreatScore] = useState(2.5)
  const [displayedScore, setDisplayedScore] = useState(2.5)

  useEffect(() => {
    let baseScore = 2.5
    if (snapshot.metrics) {
      baseScore = Math.max(2.0, Math.min(6.0, snapshot.metrics.attack.liveDensity || 2.0))
    }
    setThreatScore(Math.min(10.0, baseScore + snapshot.attacks.length * 0.4))
  }, [snapshot.attacks.length, snapshot.metrics])

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = t - last
      last = t
      setDisplayedScore((prev) => {
        const diff = threatScore - prev
        const noise =
          (Math.sin((t / 1000) * 3) * 0.5 + Math.sin((t / 1000) * 7) * 0.5) *
          0.25 *
          (0.3 + threatScore / 10)
        let next = prev + diff * (dt * 0.005)
        if (Math.abs(diff) < 0.05) {
          next = threatScore + noise
        }
        return Math.min(10, Math.max(0, next))
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [threatScore])

  if (!mounted) return null

  const cardStyle = 'relative rounded-lg border border-[#00ff88]/15 bg-[#0a0a0a] overflow-hidden'
  const now = new Date()
  const lastUpdate = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black text-[#d4d4d4] font-mono flex flex-col overflow-hidden select-none" style={{ zIndex: 10 }}>
      {snapshot.overlayActive && (
        <CriticalOverlayFx cycle={snapshot.overlayCycle} />
      )}

      <ThreatBanner
        threatScore={displayedScore}
        totalLast24h={snapshot.metrics?.attack.totalLast24h ?? snapshot.attacks.length}
        attacksPerMinute={snapshot.metrics?.attack.attacksPerMinute ?? 0}
        demoMode={snapshot.demoMode}
        onToggleDemo={actions.toggleDemoMode}
      />

      <div className="flex-1 w-full p-2 overflow-y-auto lg:overflow-hidden flex flex-col gap-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
          <StatCard label="Aktif Alertler" value={snapshot.alertCount} sub="acik" color="#ff4444" />
          <StatCard label="CVSS 9+ CVE" value={snapshot.cveCount} sub="bugun" color="#ffaa00" />
          <StatCard label="Gozlemlenen IP" value={snapshot.metrics?.attack.totalLast24h ?? 0} sub="24s" color="#00d4ff" />
          <StatCard label="Son Guncelleme" value={lastUpdate} color="#00ff88" />
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2">
          <div className={`lg:col-span-7 min-h-[400px] lg:min-h-0 ${cardStyle}`}>
            <AlertManagementWidget />
          </div>
          <div className={`lg:col-span-5 min-h-[400px] lg:min-h-0 ${cardStyle}`}>
            <CyberNewsWidget />
          </div>
        </div>

        <div className={`h-[280px] lg:h-[220px] shrink-0 ${cardStyle}`}>
          <ThreatIntelWidget />
        </div>
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
