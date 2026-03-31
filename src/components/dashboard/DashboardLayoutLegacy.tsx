'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ThreatBanner from './ThreatBanner';
import CyberNewsWidget from './CyberNewsWidget';
import AlertManagementWidget from './AlertManagementWidget';
import ThreatIntelWidget from './ThreatIntelWidget';
import CriticalAlertPanel from './CriticalAlertPanel';
import AttackReportModal from './AttackReportModal';
import CriticalOverlayFx from './CriticalOverlayFx';
import type { AttackEvent, WorkflowMetrics } from '@/lib/dashboard-types';
import { CRITICAL_EFFECT_TOKENS } from '@/lib/soc-runtime/critical-effects';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
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
  );
}

export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [cveCount, setCveCount] = useState<number>(0);

  const [threatScore, setThreatScore] = useState(2.5);
  const [displayedScore, setDisplayedScore] = useState(2.5);
  const [criticalActive, setCriticalActive] = useState(false);
  const [criticalOverlayCycle, setCriticalOverlayCycle] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  const [criticalQueue, setCriticalQueue] = useState<AttackEvent[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<AttackEvent | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const seenCriticalIds = useRef<Set<number>>(new Set());

  const coreFetchSeqRef = useRef(0);

  const fetchMetrics = useCallback(async () => {
    const seq = ++coreFetchSeqRef.current;
    try {
      const res = await fetch('/api/metrics/live', { cache: 'no-store' });
      if (res.ok && seq === coreFetchSeqRef.current) {
        setMetrics(await res.json());
      }
    } catch { }
  }, []);

  const fetchStatCounts = useCallback(async () => {
    try {
      const [alertsRes, cvesRes] = await Promise.allSettled([
        fetch('/api/alerts?limit=1', { cache: 'no-store' }),
        fetch('/api/cves?days=1', { cache: 'no-store' }),
      ]);
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const d = await alertsRes.value.json();
        setAlertCount(d.activeTotal ?? d.total ?? d.alerts?.length ?? 0);
      }
      if (cvesRes.status === 'fulfilled' && cvesRes.value.ok) {
        const d = await cvesRes.value.json();
        const high = (d.cves ?? []).filter((c: { score?: number | null; severity?: string | null }) => {
          if (typeof c.score === 'number') return c.score >= 9;
          return (c.severity ?? '').toUpperCase() === 'CRITICAL';
        }).length;
        setCveCount(high);
      }
    } catch { }
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    void fetchMetrics();
    const i = setInterval(() => void fetchMetrics(), 15_000);
    return () => clearInterval(i);
  }, [fetchMetrics]);

  useEffect(() => {
    void fetchStatCounts();
    const i = setInterval(() => void fetchStatCounts(), 60_000);
    return () => clearInterval(i);
  }, [fetchStatCounts]);

  useEffect(() => {
    let disposed = false;
    const fetchAttack = async () => {
      if (disposed) return;
      try {
        const res = await fetch('/api/live-attacks', { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json() as AttackEvent;
          if (payload?.id) setAttacks(prev => [...prev, payload].slice(-15));
        }
      } catch { }
    };
    void fetchAttack();
    const interval = demoMode ? 4_000 : 90_000;
    const t = setInterval(() => void fetchAttack(), interval);
    return () => { disposed = true; clearInterval(t); };
  }, [demoMode]);

  useEffect(() => {
    const newCriticals = attacks.filter(a => a.severity === 'critical' && !seenCriticalIds.current.has(a.id));
    if (newCriticals.length > 0) {
      newCriticals.forEach(a => seenCriticalIds.current.add(a.id));
      setCriticalQueue(prev => [...prev, ...newCriticals]);
      setPanelOpen(true);
      setCriticalActive(true);
      setCriticalOverlayCycle(prev => prev + 1);
      const t = setTimeout(() => setCriticalActive(false), CRITICAL_EFFECT_TOKENS.overlayDurationMs);
      return () => clearTimeout(t);
    }
  }, [attacks]);

  useEffect(() => {
    let baseScore = 2.5;
    if (metrics) baseScore = Math.max(2.0, Math.min(6.0, metrics.attack.liveDensity || 2.0));
    setThreatScore(Math.min(10.0, baseScore + attacks.length * 0.4));
  }, [attacks, metrics]);

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();
    const animate = (t: number) => {
      const dt = t - lastTime; lastTime = t;
      setDisplayedScore(prev => {
        const diff = threatScore - prev;
        const noise = (Math.sin(t / 1000 * 3) * 0.5 + Math.sin(t / 1000 * 7) * 0.5) * 0.25 * (0.3 + threatScore / 10);
        let n = prev + diff * (dt * 0.005);
        if (Math.abs(diff) < 0.05) n = threatScore + noise;
        return Math.min(10, Math.max(0, n));
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [threatScore]);

  if (!mounted) return null;

  const cardStyle = "relative rounded-lg border border-[#00ff88]/15 bg-[#0a0a0a] overflow-hidden";
  const now = new Date();
  const lastUpdate = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 bg-black text-[#d4d4d4] font-mono flex flex-col overflow-hidden select-none"
      style={{ zIndex: 10 }}
    >

      {/* ═══ CRITICAL ALERT FULL-SCREEN FX ═══ */}
      {criticalActive && (
        <CriticalOverlayFx cycle={criticalOverlayCycle} />
      )}

      {/* ═══ THREAT BANNER ═══ */}
      <ThreatBanner
        threatScore={displayedScore}
        totalLast24h={metrics?.attack.totalLast24h ?? attacks.length}
        attacksPerMinute={metrics?.attack.attacksPerMinute ?? 0}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode(d => !d)}
      />

      {/* ═══ DASHBOARD GRID ═══ */}
      <div className="flex-1 w-full p-2 overflow-y-auto lg:overflow-hidden flex flex-col gap-2">

        {/* ROW 1: Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
          <StatCard
            label="Aktif Alertler"
            value={alertCount}
            sub="açık"
            color="#ff4444"
          />
          <StatCard
            label="CVSS 9+ CVE"
            value={cveCount}
            sub="bugün"
            color="#ffaa00"
          />
          <StatCard
            label="Gözlemlenen IP"
            value={metrics?.attack.totalLast24h ?? 0}
            sub="24s"
            color="#00d4ff"
          />
          <StatCard
            label="Son Güncelleme"
            value={lastUpdate}
            color="#00ff88"
          />
        </div>

        {/* ROW 2: Alert Management + Cyber News */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2">
          <div className={`lg:col-span-7 min-h-[400px] lg:min-h-0 ${cardStyle}`}>
            <AlertManagementWidget />
          </div>
          <div className={`lg:col-span-5 min-h-[400px] lg:min-h-0 ${cardStyle}`}>
            <CyberNewsWidget />
          </div>
        </div>

        {/* ROW 3: Threat Intel */}
        <div className={`h-[280px] lg:h-[220px] shrink-0 ${cardStyle}`}>
          <ThreatIntelWidget />
        </div>

      </div>

      {/* ── Critical Alert Panel ── */}
      <CriticalAlertPanel
        queue={criticalQueue}
        open={panelOpen}
        onReport={a => { setReportTarget(a); setReportModalOpen(true); }}
        onDismiss={id => setCriticalQueue(prev => {
          const next = prev.filter(a => a.id !== id);
          if (next.length === 0) setPanelOpen(false);
          return next;
        })}
        onClose={() => setPanelOpen(false)}
      />

      {/* ── Attack Report Modal ── */}
      <AttackReportModal
        attack={reportTarget}
        open={reportModalOpen}
        onClose={() => { setReportModalOpen(false); setReportTarget(null); }}
      />

    </div>
  );
}

