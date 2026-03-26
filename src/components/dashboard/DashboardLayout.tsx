'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import LiveIntelFeedWidget from './LiveIntelFeedWidget';
import NetworkTrafficWidget from './NetworkTrafficWidget';
import { AlertTriangle, Globe } from 'lucide-react';
import type { AttackEvent, CVEItem, WorkflowMetrics } from '@/lib/dashboard-types';


export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [cves, setCves] = useState<CVEItem[]>([]);
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);

  const [threatScore, setThreatScore] = useState(2.5);
  const [displayedScore, setDisplayedScore] = useState(2.5);

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
    const attackInterval = setInterval(() => { void fetchAttack(); }, 90_000);
    return () => { disposed = true; clearInterval(attackInterval); };
  }, []);

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

  const cardStyle ="relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)]";

  return (
    <div className="fixed inset-0 bg-[#050a14] text-slate-200 font-mono flex flex-col overflow-hidden select-none" style={{ zIndex: 10 }}>


      {/* ═══ DASHBOARD — RESPONSIVE GRID LAYOUT ═══ */}
      {/* 
        Mobile (<1024px): Single column, natural flex layout, scrolls vertically.
        Desktop (>=1024px): CSS Grid (12 cols, 2 specific rows), fills viewport, no scroll.
      */}
      <div className="flex-1 w-full p-2 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12 lg:grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-3">

        {/* ─── LIVE INTEL FEED ─── */}
        <div className={`lg:col-span-3 min-h-[400px] lg:min-h-0 h-full ${cardStyle}`}>
          <LiveIntelFeedWidget attacks={attacks} threatScore={displayedScore} />
        </div>

        {/* ─── CYBER THREAT MAP ─── */}
        <div className={`lg:col-span-6 min-h-[350px] lg:min-h-0 h-full ${cardStyle}`}>
          <ThreatMapWidget attacks={attacks} />
        </div>

        {/* ─── SYSTEM STATUS & CVE ─── */}
        <div className="lg:col-span-3 min-h-max lg:min-h-0 h-full flex flex-col gap-3">
          <div className={`flex-[1.2] min-h-[250px] lg:min-h-0 ${cardStyle}`}>
            <SystemMonitorWidget />
          </div>
          <div className={`flex-1 min-h-[350px] lg:min-h-0 ${cardStyle}`}>
            <CveFeedWidget cves={cves} />
          </div>
        </div>

        {/* ─── NETWORK TRAFFIC ─── */}
        <div className={`lg:col-span-7 lg:row-start-2 min-h-[350px] lg:min-h-0 h-full ${cardStyle}`}>
          <NetworkTrafficWidget />
        </div>

        {/* ─── GEO-ANALYTICS ─── */}
        <div className={`lg:col-span-5 lg:row-start-2 min-h-[300px] lg:min-h-0 h-full flex flex-col ${cardStyle}`}>
          <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-var(--bg-panel)/80 shrink-0">
            <span className="text-[var(--text-title)] font-bold text-slate-300 tracking-widest uppercase">// GEO-ANALYTICS</span>
            <span className="text-slate-600 text-[9px]">⋮</span>
          </div>
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <svg viewBox="0 0 600 300" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <mask id="geo-mask-v2"><image href="/world.svg" x="0" y="0" width="600" height="300" /></mask>
                <radialGradient id="heatRed" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--threat-red)" stopOpacity="0.9" /><stop offset="40%" stopColor="var(--warning-orange)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--warning-orange)" stopOpacity="0" /></radialGradient>
                <radialGradient id="heatCyan" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.7" /><stop offset="50%" stopColor="var(--accent-cyan)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" /></radialGradient>
              </defs>
              <rect x="0" y="0" width="600" height="300" fill="var(--bg-primary)" mask="url(#geo-mask-v2)" />
              <rect x="0" y="0" width="600" height="300" fill="var(--accent-cyan)" mask="url(#geo-mask-v2)" opacity="0.06" />
              <circle cx="370" cy="88" r="35" fill="url(#heatRed)" className="animate-pulse" />
              <circle cx="445" cy="122" r="30" fill="url(#heatRed)" className="animate-pulse" style={{animationDelay:'0.3s'}} />
              <circle cx="148" cy="118" r="28" fill="url(#heatRed)" className="animate-pulse" style={{animationDelay:'0.5s'}} />
              <circle cx="295" cy="108" r="22" fill="url(#heatRed)" />
              <circle cx="190" cy="198" r="18" fill="url(#heatCyan)" />
              <circle cx="400" cy="152" r="16" fill="url(#heatCyan)" className="animate-pulse" style={{animationDelay:'0.2s'}} />
              <circle cx="520" cy="200" r="14" fill="url(#heatCyan)" />
              <circle cx="308" cy="218" r="12" fill="url(#heatCyan)" />
              <circle cx="370" cy="88" r="3" fill="var(--threat-red)" /><circle cx="445" cy="122" r="3" fill="var(--threat-red)" />
              <circle cx="148" cy="118" r="3" fill="var(--threat-red)" /><circle cx="295" cy="108" r="2.5" fill="var(--threat-red)" />
              <circle cx="190" cy="198" r="2" fill="var(--accent-cyan)" /><circle cx="400" cy="152" r="2" fill="var(--accent-cyan)" />
            </svg>
          </div>
          <div className="flex justify-between text-[var(--text-body)] text-slate-400 font-bold border-t border-cyan-500/15 px-3 py-1.5 bg-var(--bg-panel)/80 shrink-0">
            <span className="text-[var(--threat-red)] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
            <span className="text-[var(--accent-cyan)] flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
          </div>
        </div>

      </div>
    </div>
  );
}
