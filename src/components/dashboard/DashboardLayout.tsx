'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import LiveIntelFeedWidget from './LiveIntelFeedWidget';
import AttackOriginWidget from './AttackOriginWidget';
import SocTriageWidget from './SocTriageWidget';
import CriticalAlertPanel from './CriticalAlertPanel';
import AttackReportModal from './AttackReportModal';
import ThreatBanner from './ThreatBanner';
import KillChainWidget from './KillChainWidget';
import type { AttackEvent, CVEItem, WorkflowMetrics } from '@/lib/dashboard-types';


export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [cves, setCves] = useState<CVEItem[]>([]);
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);

  const [threatScore, setThreatScore] = useState(2.5);
  const [displayedScore, setDisplayedScore] = useState(2.5);
  const [criticalActive, setCriticalActive] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  /* ── Critical alert panel ── */
  const [criticalQueue, setCriticalQueue] = useState<AttackEvent[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<AttackEvent | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const seenCriticalIds = useRef<Set<number>>(new Set());

  const coreFetchSeqRef = useRef(0);

  const fetchCorePanels = useCallback(async () => {
    const fetchSeq = ++coreFetchSeqRef.current;
    try {
      const response = await fetch('/api/metrics/live', { cache: 'no-store' });
      if (response.ok && fetchSeq === coreFetchSeqRef.current) {
        const payload = (await response.json()) as WorkflowMetrics;
        setMetrics(payload);
      }
    } catch (e) { }
  }, []);

  const loadIntelPanels = useCallback(async () => {
    try {
      const cvesRes = await fetch('/api/cves?days=1', { cache: 'no-store' });
      if (cvesRes.ok) { const p = await cvesRes.json(); setCves((p.cves ?? []).slice(0, 10)); }
    } catch (e) { }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => { void loadIntelPanels(); const i = setInterval(() => { void loadIntelPanels(); }, 60_000); return () => clearInterval(i); }, [loadIntelPanels]);
  useEffect(() => { void fetchCorePanels(); const i = setInterval(() => { void fetchCorePanels(); }, 15_000); return () => clearInterval(i); }, [fetchCorePanels]);

  useEffect(() => {
    let disposed = false;
    const fetchAttack = async () => {
      if (disposed) return;
      try {
        const res = await fetch('/api/live-attacks', { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json() as AttackEvent;
          if (payload && payload.id) { setAttacks(prev => [...prev, payload].slice(-15)); }
        }
      } catch { }
    };
    void fetchAttack();
    const interval = demoMode ? 4_000 : 90_000;
    const attackInterval = setInterval(() => { void fetchAttack(); }, interval);
    return () => { disposed = true; clearInterval(attackInterval); };
  }, [demoMode]);

  /* ── Critical alert trigger (screen pulse + panel) ── */
  useEffect(() => {
    const newCriticals = attacks.filter(
      a => a.severity === 'critical' && !seenCriticalIds.current.has(a.id)
    );
    if (newCriticals.length > 0) {
      newCriticals.forEach(a => seenCriticalIds.current.add(a.id));
      setCriticalQueue(prev => [...prev, ...newCriticals]);
      setPanelOpen(true);
      setCriticalActive(true);
      const t = setTimeout(() => setCriticalActive(false), 7000);
      return () => clearTimeout(t);
    }
  }, [attacks]);

  useEffect(() => {
    let baseScore = 2.5;
    if (metrics) { baseScore = Math.max(2.0, Math.min(6.0, metrics.attack.liveDensity || 2.0)); }
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

  const cardStyle = "relative rounded-lg border border-violet-500/20 bg-[#0d0018]/70 overflow-hidden shadow-[inset_0_0_30px_rgba(139,92,246,0.04)]";

  return (
    <div
      className={`fixed inset-0 bg-[#06000f] text-slate-200 font-mono flex flex-col overflow-hidden select-none${criticalActive ? ' critical-alert-active' : ''}`}
      style={{ zIndex: 10 }}
    >

      {/* ═══ CRITICAL ALERT FULL-SCREEN FX ═══ */}
      {criticalActive && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 48 }}>
          {/* Scan line 1 — immediate sweep */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 7,
            background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.6) 8%, #ef4444 25%, #ff6666 45%, #ffffff 50%, #ff6666 55%, #ef4444 75%, rgba(239,68,68,0.6) 92%, transparent 100%)',
            boxShadow: '0 0 40px 20px rgba(239,68,68,0.80), 0 0 120px 60px rgba(239,68,68,0.35)',
            animation: 'critical-scan-sweep 1.6s cubic-bezier(0.3,0,0.7,1) forwards',
          }} />
          {/* Scan line 2 — second sweep */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 6,
            background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.5) 10%, #ef4444dd 30%, #ff8888 50%, #ffffffaa 55%, #ff8888 60%, #ef4444dd 80%, rgba(239,68,68,0.5) 90%, transparent 100%)',
            boxShadow: '0 0 30px 14px rgba(239,68,68,0.70), 0 0 90px 45px rgba(239,68,68,0.28)',
            animation: 'critical-scan-sweep 1.7s cubic-bezier(0.3,0,0.7,1) 1.8s forwards',
            opacity: 0,
          }} />
          {/* Scan line 3 — third sweep */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 5,
            background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.4) 12%, #ef4444bb 32%, #ff9999 50%, #ffffff80 55%, #ff9999 60%, #ef4444bb 78%, rgba(239,68,68,0.4) 88%, transparent 100%)',
            boxShadow: '0 0 22px 10px rgba(239,68,68,0.55), 0 0 70px 35px rgba(239,68,68,0.20)',
            animation: 'critical-scan-sweep 1.8s cubic-bezier(0.3,0,0.7,1) 3.8s forwards',
            opacity: 0,
          }} />
          {/* Scan line 4 — final sweep */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 5,
            background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.35) 12%, #ef4444aa 32%, #ff9999 50%, #ffffff60 55%, #ff9999 60%, #ef4444aa 78%, rgba(239,68,68,0.35) 88%, transparent 100%)',
            boxShadow: '0 0 18px 8px rgba(239,68,68,0.45), 0 0 55px 28px rgba(239,68,68,0.16)',
            animation: 'critical-scan-sweep 1.9s cubic-bezier(0.3,0,0.7,1) 5.6s forwards',
            opacity: 0,
          }} />
          {/* Inset border flash */}
          <div style={{
            position: 'absolute', inset: 0,
            animation: 'critical-border-flash 7s ease-in-out forwards',
          }} />
          {/* Red edge vignette — heavy */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 25%, rgba(239,68,68,0.30) 70%, rgba(239,68,68,0.55) 100%)',
            animation: 'critical-vignette 7s ease-in-out forwards',
          }} />
          {/* Corner bleeds */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at top left, rgba(239,68,68,0.25) 0%, transparent 40%), radial-gradient(ellipse at top right, rgba(239,68,68,0.25) 0%, transparent 40%), radial-gradient(ellipse at bottom left, rgba(239,68,68,0.20) 0%, transparent 35%), radial-gradient(ellipse at bottom right, rgba(239,68,68,0.20) 0%, transparent 35%)',
            animation: 'critical-vignette 7s ease-in-out forwards',
          }} />
        </div>
      )}

      {/* ═══ NATIONAL THREAT BANNER ═══ */}
      <ThreatBanner
        threatScore={displayedScore}
        totalLast24h={metrics?.attack.totalLast24h ?? attacks.length}
        attacksPerMinute={metrics?.attack.attacksPerMinute ?? 0}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode(d => !d)}
      />

      {/* ═══ DASHBOARD — RESPONSIVE GRID LAYOUT ═══ */}
      {/* 
        Mobile (<1024px): Single column, natural flex layout, scrolls vertically.
        Desktop (>=1024px): CSS Grid (12 cols, 2 specific rows), fills viewport, no scroll.
      */}
      {/*
        Layout — 12 kolon, 2 satır
        Row 1 (3fr ~60%): GHOST RADAR [3] | CYBER THREAT MAP [6] | NEURAL CORTEX [3]
        Row 2 (2fr ~40%): VULN STREAM [3] | ATTACK ORIGIN    [5] | SOC TRIAGE    [4]
      */}
      <div className="flex-1 w-full p-2 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12 lg:grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-3">

        {/* ─── ROW 1 ─── */}

        {/* GHOST RADAR — 3 kolon */}
        <div className={`lg:col-span-3 lg:row-start-1 min-h-[400px] lg:min-h-0 ${cardStyle}`}>
          <LiveIntelFeedWidget
            attacks={attacks}
            threatScore={displayedScore}
            metrics={metrics}
            onReport={a => { setReportTarget(a); setReportModalOpen(true); }}
          />
        </div>

        {/* CYBER THREAT MAP — 6 kolon, merkez */}
        <div className={`lg:col-span-6 lg:row-start-1 min-h-[350px] lg:min-h-0 ${cardStyle}`}>
          <ThreatMapWidget attacks={attacks} />
        </div>

        {/* NEURAL CORTEX — 3 kolon, tek başına */}
        <div className={`lg:col-span-3 lg:row-start-1 min-h-[300px] lg:min-h-0 ${cardStyle}`}>
          <SystemMonitorWidget metrics={metrics} />
        </div>

        {/* ─── ROW 2 ─── */}

        {/* VULN STREAM — 3 kolon */}
        <div className={`lg:col-span-3 lg:row-start-2 min-h-[280px] lg:min-h-0 ${cardStyle}`}>
          <CveFeedWidget cves={cves} />
        </div>

        {/* KILL CHAIN — 5 kolon */}
        <div className={`lg:col-span-5 lg:row-start-2 min-h-[280px] lg:min-h-0 ${cardStyle}`}>
          <KillChainWidget attacks={attacks} metrics={metrics} />
        </div>

        {/* SOC TRIAGE — 4 kolon */}
        <div className={`lg:col-span-4 lg:row-start-2 min-h-[280px] lg:min-h-0 ${cardStyle}`}>
          <SocTriageWidget metrics={metrics} />
        </div>

      </div>

      {/* ── Critical Alert Slide-in Panel ── */}
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

      {/* ── Attack Investigation Report Modal ── */}
      <AttackReportModal
        attack={reportTarget}
        open={reportModalOpen}
        onClose={() => { setReportModalOpen(false); setReportTarget(null); }}
      />

    </div>
  );
}
