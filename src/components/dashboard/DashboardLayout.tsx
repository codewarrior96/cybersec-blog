'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CveFeedWidget from './CveFeedWidget';
import ThreatMapWidget from './ThreatMapWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import LiveIntelFeedWidget from './LiveIntelFeedWidget';
import { Shield, Bell, Settings, LogOut, AlertTriangle, Globe } from 'lucide-react';
import { useAuthSession, logoutAuth } from '@/lib/auth-client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { AttackEvent, CVEItem, NewsItem, WorkflowMetrics } from '@/lib/dashboard-types';


export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const session = useAuthSession(null);
  const user = session?.user;
  const router = useRouter();
  const pathname = usePathname();

  // Live Data States
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [cves, setCves] = useState<CVEItem[]>([]);
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [streamMode, setStreamMode] = useState<'connecting' | 'live' | 'degraded'>('connecting');
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);

  // Dynamic Header States
  const [threatScore, setThreatScore] = useState(2.5);
  const [displayedScore, setDisplayedScore] = useState(2.5);
  const [activeAlerts, setActiveAlerts] = useState(0);

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
      const [newsRes, cvesRes] = await Promise.all([
        fetch('/api/cybernews', { cache: 'no-store' }),
        fetch('/api/cves?days=1', { cache: 'no-store' })
      ]);
      
      if (newsRes.ok) {
        const payload = await newsRes.json();
        setNewsItems(payload.items ?? []);
      }
      if (cvesRes.ok) {
        const payload = await cvesRes.json();
        setCves((payload.cves ?? []).slice(0, 10));
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    setMounted(true);
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadIntelPanels();
    const interval = setInterval(() => { void loadIntelPanels(); }, 60_000);
    return () => clearInterval(interval);
  }, [loadIntelPanels]);

  useEffect(() => {
    void fetchCorePanels();
    const interval = setInterval(() => { void fetchCorePanels(); }, 15_000);
    return () => clearInterval(interval);
  }, [fetchCorePanels]);

  useEffect(() => {
    let disposed = false;
    const fetchAttack = async () => {
      if (disposed) return;
      try {
        const res = await fetch('/api/live-attacks', { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json() as AttackEvent;
          if (payload && payload.id) {
            setAttacks((prev) => [...prev, payload].slice(-15));
            setStreamMode('live');
          }
        } else { setStreamMode('degraded'); }
      } catch { setStreamMode('degraded'); }
    };
    void fetchAttack();
    setStreamMode('live');
    const attackInterval = setInterval(() => { void fetchAttack(); }, 90_000);
    return () => { disposed = true; clearInterval(attackInterval); };
  }, []);

  useEffect(() => {
    let baseScore = 2.5;
    if (metrics) { baseScore = Math.max(2.0, Math.min(6.0, metrics.attack.liveDensity || 2.0)); }
    const attackSpike = attacks.length * 0.4;
    setThreatScore(Math.min(10.0, baseScore + attackSpike));
    const baseAlerts = metrics?.shiftSnapshot.openCritical || 12;
    setActiveAlerts(baseAlerts + Math.floor(attacks.length / 2));
  }, [attacks, metrics]);

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      setDisplayedScore(prev => {
        const diff = threatScore - prev;
        const intensity = threatScore / 10;
        const timeSec = currentTime / 1000;
        const noise = (Math.sin(timeSec * 3) * 0.5 + Math.sin(timeSec * 7) * 0.5) * 0.25 * (0.3 + intensity);
        let newScore = prev + diff * (deltaTime * 0.005);
        if (Math.abs(diff) < 0.05) { newScore = threatScore + noise; }
        return Math.min(10, Math.max(0, newScore));
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [threatScore]);

  if (!mounted) return null;

  const getThreatLevelInfo = (score: number) => {
    if (score < 4.0) return { text: 'LOW', color: 'text-[#00ff41]' };
    if (score < 7.5) return { text: 'ELEVATED', color: 'text-orange-500' };
    return { text: 'HIGH', color: 'text-red-500' };
  };
  const threatInfo = getThreatLevelInfo(displayedScore);

  const navItems = [
    { label: 'HOME', href: '/' },
    { label: 'BLOG', href: '/blog' },
    { label: 'COMMUNITY', href: '/community' },
    { label: 'CVE-RADAR', href: '/cve-radar' },
    { label: 'TIMELINE', href: '/breach-timeline' },
    { label: 'PORTFOLIO', href: '/portfolio' },
    { label: 'ABOUT', href: '/about' },
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  const warningCount = metrics?.shiftSnapshot.slaBreaches || 14;

  return (
    <div className="fixed inset-0 bg-[#050a14] text-slate-200 font-mono flex flex-col overflow-hidden select-none" style={{ zIndex: 10 }}>

      {/* ═══════════════════ TOP NAVBAR ═══════════════════ */}
      <header className="shrink-0 w-full h-[56px] flex items-center px-4 bg-[#0a1020]/90 border-b border-cyan-500/20 backdrop-blur-sm relative z-20"
        style={{ boxShadow: '0 2px 20px rgba(34,211,238,0.08)' }}>
        
        {/* Cyan glow bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        {/* Left — Logo */}
        <div className="flex items-center gap-2.5 mr-6 shrink-0">
          <div className="w-8 h-8 relative flex items-center justify-center">
            <Shield className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]" strokeWidth={1.5} />
            <span className="absolute text-[8px] font-bold text-cyan-100 mt-1">C</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-bold text-cyan-400 tracking-wider">BREACH TERMINAL</span>
            <span className="text-[9px] text-slate-500 tracking-widest">OS v4.1</span>
          </div>
        </div>

        {/* Center — Navigation */}
        <nav className="flex-1 flex items-center justify-center gap-1">
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`px-3 py-1.5 text-[10px] font-bold tracking-widest transition-all duration-200 relative ${
                  active
                    ? 'text-cyan-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right — Badges + Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Threat badge */}
          <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded border border-red-500/50 bg-red-500/10 text-red-400">
            ⚡ THREATS: {activeAlerts}
          </span>
          {/* Warning badge */}
          <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded border border-amber-500/50 bg-amber-500/10 text-amber-400">
            ⚠ WARNS: {warningCount}
          </span>
          {/* Time */}
          <span className="text-[11px] text-cyan-400/70 font-mono tracking-wider">{time} <span className="text-[8px] text-slate-500">UTC</span></span>
          {/* Bell */}
          <button className="text-slate-500 hover:text-cyan-400 transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>
          {/* Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/50">
            <div className="w-7 h-7 rounded-full border border-cyan-500/50 overflow-hidden relative">
              <img src="/skull.jpg" alt="avatar" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#00ff41] rounded-full border border-[#050a14]" />
            </div>
            <span className="text-[10px] text-slate-400 hidden xl:inline">{user?.displayName || 'GHOST ADMIN'}</span>
          </div>
          {/* Logout */}
          <button onClick={async () => { await logoutAuth(); router.push('/'); }}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold tracking-wider text-red-400 border border-red-500/40 bg-red-500/5 hover:bg-red-500/20 transition-colors rounded">
            <LogOut className="w-3 h-3" />
            LOGOUT
          </button>
        </div>
      </header>

      {/* ═══════════════════ MAIN DASHBOARD GRID ═══════════════════ */}
      <div className="flex-1 min-h-0 w-full grid grid-cols-12 grid-rows-[3fr_2fr] gap-2 p-3 pt-2 overflow-hidden">

        {/* ─── LEFT: Live Intel Feed (row-span-2) ─── */}
        <div className="col-span-3 row-span-2 relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)]">
          <LiveIntelFeedWidget attacks={attacks} threatScore={displayedScore} />
        </div>

        {/* ─── CENTER TOP: Cyber Threat Map ─── */}
        <div className="col-span-6 relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)]">
          <ThreatMapWidget attacks={attacks} />
        </div>

        {/* ─── RIGHT TOP: System Status ─── */}
        <div className="col-span-3 relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)]">
          <SystemMonitorWidget />
        </div>

        {/* ─── CENTER BOTTOM: CVE Feed ─── */}
        <div className="col-span-6 relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)]">
          <CveFeedWidget cves={cves} />
        </div>

        {/* ─── RIGHT BOTTOM: Geo-Analytics ─── */}
        <div className="col-span-3 relative rounded-lg border border-cyan-500/20 bg-[#0a1020]/60 overflow-hidden shadow-[inset_0_0_30px_rgba(34,211,238,0.03)] flex flex-col">
          <div className="flex justify-between items-center px-3 py-2 border-b border-cyan-500/15 bg-[#0a1020]/80 shrink-0">
            <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">GEO-ANALYTICS</span>
            <span className="text-slate-600 text-[9px]">...</span>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
            <div className="w-full h-full relative flex items-center justify-center">
              <svg viewBox="0 0 600 300" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <mask id="geo-mask">
                    <image href="/world.svg" x="0" y="0" width="600" height="300" />
                  </mask>
                </defs>
                <rect x="0" y="0" width="600" height="300" fill="#0d2a3a" mask="url(#geo-mask)" opacity="1" />
                <rect x="0" y="0" width="600" height="300" fill="#22d3ee" mask="url(#geo-mask)" opacity="0.08" />
                {/* Attack origin heatmap dots */}
                <circle cx="295" cy="108" r="3" fill="#ef4444" className="animate-pulse" />
                <circle cx="148" cy="118" r="5" fill="#ef4444" className="animate-pulse" />
                <circle cx="148" cy="118" r="10" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.5" className="animate-ping" />
                <circle cx="370" cy="88" r="4" fill="#ef4444" className="animate-pulse" style={{animationDelay:'0.5s'}} />
                <circle cx="445" cy="122" r="5" fill="#ef4444" className="animate-pulse" style={{animationDelay:'0.3s'}} />
                <circle cx="190" cy="198" r="3" fill="#22d3ee" className="animate-pulse" />
                <circle cx="400" cy="152" r="3" fill="#22d3ee" className="animate-pulse" style={{animationDelay:'0.2s'}} />
                {/* Arcs */}
                <path d="M 295 108 Q 330 95 370 88" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8" fill="none" />
                <path d="M 295 108 Q 370 95 445 122" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8" fill="none" />
                <path d="M 295 108 Q 220 112 148 118" stroke="rgba(34,211,238,0.5)" strokeWidth="0.8" fill="none" />
              </svg>
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-bold border-t border-cyan-500/15 px-3 py-1.5 bg-[#0a1020]/80 shrink-0">
            <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ACTIVE ALERTS</span>
            <span className="text-cyan-400 flex items-center gap-1"><Globe className="w-3 h-3"/> GLOBAL</span>
          </div>
        </div>

      </div>
    </div>
  );
}
